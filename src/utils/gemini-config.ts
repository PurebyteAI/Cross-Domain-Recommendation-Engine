import { GeminiService } from '@/services/gemini.service'

/**
 * Utility functions for Gemini model configuration
 */

export interface ModelPerformanceProfile {
  model: string
  speed: 'fast' | 'medium' | 'slow'
  quality: 'good' | 'better' | 'best'
  costTier: 'low' | 'medium' | 'high'
  recommendedFor: string[]
}

/**
 * Performance profiles for different Gemini models
 */
export const MODEL_PROFILES: ModelPerformanceProfile[] = [
  {
    model: 'gemini-2.0-flash-lite',
    speed: 'fast',
    quality: 'good',
    costTier: 'low',
    recommendedFor: ['high-volume', 'real-time', 'cost-sensitive']
  },
  {
    model: 'gemini-1.5-flash',
    speed: 'fast',
    quality: 'better',
    costTier: 'medium',
    recommendedFor: ['balanced', 'general-purpose']
  },
  {
    model: 'gemini-1.5-pro',
    speed: 'medium',
    quality: 'best',
    costTier: 'high',
    recommendedFor: ['high-quality', 'complex-reasoning', 'premium-features']
  },
  {
    model: 'gemini-2.0-flash-exp',
    speed: 'fast',
    quality: 'better',
    costTier: 'medium',
    recommendedFor: ['experimental', 'latest-features']
  }
]

/**
 * Get recommended model based on use case
 */
export function getRecommendedModel(useCase: 'cost-effective' | 'balanced' | 'high-quality' | 'experimental'): string {
  switch (useCase) {
    case 'cost-effective':
      return 'gemini-2.0-flash-lite'
    case 'balanced':
      return 'gemini-1.5-flash'
    case 'high-quality':
      return 'gemini-1.5-pro'
    case 'experimental':
      return 'gemini-2.0-flash-exp'
    default:
      return 'gemini-2.0-flash-lite'
  }
}

/**
 * Get model profile information
 */
export function getModelProfile(modelName: string): ModelPerformanceProfile | undefined {
  return MODEL_PROFILES.find(profile => profile.model === modelName)
}

/**
 * Validate and suggest alternative if model is not optimal
 */
export function validateModelChoice(modelName: string, expectedVolume: 'low' | 'medium' | 'high'): {
  isOptimal: boolean
  suggestion?: string
  reason?: string
} {
  const profile = getModelProfile(modelName)
  
  if (!profile) {
    return {
      isOptimal: false,
      suggestion: getRecommendedModel('balanced'),
      reason: 'Model not found in performance profiles'
    }
  }

  // Check if model is optimal for expected volume
  if (expectedVolume === 'high' && profile.speed !== 'fast') {
    return {
      isOptimal: false,
      suggestion: getRecommendedModel('cost-effective'),
      reason: 'For high volume, consider a faster model'
    }
  }

  if (expectedVolume === 'low' && profile.costTier === 'high') {
    return {
      isOptimal: false,
      suggestion: getRecommendedModel('cost-effective'),
      reason: 'For low volume, consider a more cost-effective model'
    }
  }

  return { isOptimal: true }
}

/**
 * Create optimized Gemini service based on environment
 */
export function createOptimizedGeminiService(environment: 'development' | 'staging' | 'production'): GeminiService {
  let model: string
  let temperature: number
  let maxRetries: number

  switch (environment) {
    case 'development':
      model = getRecommendedModel('cost-effective')
      temperature = 0.8 // More creative for testing
      maxRetries = 1 // Fail fast in development
      break
    case 'staging':
      model = getRecommendedModel('balanced')
      temperature = 0.7
      maxRetries = 2
      break
    case 'production':
      model = process.env.GEMINI_MODEL || getRecommendedModel('balanced')
      temperature = 0.7
      maxRetries = 3
      break
  }

  console.log(`🤖 Initializing Gemini service for ${environment} with model: ${model}`)
  
  const profile = getModelProfile(model)
  if (profile) {
    console.log(`📊 Model profile: ${profile.speed} speed, ${profile.quality} quality, ${profile.costTier} cost`)
  }

  return new GeminiService({
    model,
    temperature,
    retryConfig: {
      maxRetries,
      backoffMultiplier: 1.5,
      initialDelay: 500,
      maxDelay: 5000
    }
  })
}

/**
 * Log model performance metrics
 */
export function logModelMetrics(modelName: string, responseTime: number, success: boolean): void {
  const profile = getModelProfile(modelName)
  const status = success ? '✅' : '❌'
  
  console.log(`${status} ${modelName} | ${responseTime}ms | ${profile?.speed || 'unknown'} speed`)
  
  // Log warnings for performance issues
  if (responseTime > 5000) {
    console.warn(`⚠️  Slow response from ${modelName}: ${responseTime}ms`)
  }
  
  if (!success && profile?.speed === 'fast') {
    console.warn(`⚠️  Fast model ${modelName} failed - consider fallback strategy`)
  }
}