import { GoogleGenerativeAI, GenerativeModel, SafetySetting, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { Entity, Recommendation, QlooTag, RetryConfig } from '@/types'

export interface ExplanationRequest {
  inputEntity: Entity
  recommendedEntity: Entity
  sharedThemes: QlooTag[]
  affinityScore: number
}

export interface BatchExplanationRequest {
  inputEntity: Entity
  recommendations: Array<{
    entity: Entity
    sharedThemes: QlooTag[]
    affinityScore: number
  }>
}

export interface ExplanationResponse {
  explanation: string
  confidence: number
  filtered: boolean
  processingTime: number
}

export interface BatchExplanationResponse {
  explanations: Array<{
    entityId: string
    explanation: string
    confidence: number
    filtered: boolean
  }>
  totalProcessingTime: number
  successCount: number
  failureCount: number
}

export interface GeminiConfig {
  apiKey?: string
  model?: string
  temperature?: number
  topK?: number
  topP?: number
  maxOutputTokens?: number
  retryConfig?: RetryConfig
}

/**
 * Custom error class for Gemini service errors
 */
export class GeminiServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly operation: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'GeminiServiceError'
  }

  /**
   * Check if error is retryable
   */
  get isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429
  }

  /**
   * Check if error is a rate limit error
   */
  get isRateLimit(): boolean {
    return this.statusCode === 429
  }

  /**
   * Check if error is a client error (4xx)
   */
  get isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * Check if error is a server error (5xx)
   */
  get isServerError(): boolean {
    return this.statusCode >= 500
  }
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: GenerativeModel
  private retryConfig: RetryConfig
  private safetySettings: SafetySetting[]
  private modelName: string

  constructor(config?: GeminiConfig) {
    const apiKey = config?.apiKey || process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('Gemini API key is required')
    }

    // Use configurable model from environment or config, with fallback
    this.modelName = config?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        topK: config?.topK ?? 40,
        topP: config?.topP ?? 0.95,
        maxOutputTokens: config?.maxOutputTokens ?? 200,
      }
    })

    this.retryConfig = config?.retryConfig || {
      maxRetries: 2,
      backoffMultiplier: 1.5,
      initialDelay: 500,
      maxDelay: 5000
    }

    // Configure safety settings for content filtering
    this.safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ]
  }

  /**
   * Generate explanation for a single recommendation
   */
  async generateExplanation(request: ExplanationRequest): Promise<ExplanationResponse> {
    const startTime = Date.now()
    
    try {
      const prompt = this.buildExplanationPrompt(request)
      const result = await this.executeWithRetry(async () => {
        try {
          return await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            safetySettings: this.safetySettings
          })
        } catch (error) {
          // Handle model-specific errors
          if (error instanceof Error && error.message.includes('model')) {
            console.warn(`Model ${this.modelName} error, falling back to default behavior:`, error.message)
          }
          throw error
        }
      })

      const response = result.response
      const explanation = response.text().trim()
      
      // Check if content was filtered
      const filtered = response.candidates?.[0]?.finishReason === 'SAFETY'
      
      // Calculate confidence based on affinity score and response quality
      const confidence = this.calculateConfidence(request.affinityScore, explanation, filtered)

      return {
        explanation: filtered ? this.getFallbackExplanation(request) : explanation,
        confidence,
        filtered,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('Error generating explanation:', error)
      return {
        explanation: this.getFallbackExplanation(request),
        confidence: 0.3,
        filtered: false,
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Generate explanations for multiple recommendations in batch
   */
  async generateBatchExplanations(request: BatchExplanationRequest): Promise<BatchExplanationResponse> {
    const startTime = Date.now()
    const explanations: BatchExplanationResponse['explanations'] = []
    let successCount = 0
    let failureCount = 0

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5
    const batches = this.chunkArray(request.recommendations, batchSize)

    for (const batch of batches) {
      const batchPromises = batch.map(async (rec) => {
        try {
          const explanationRequest: ExplanationRequest = {
            inputEntity: request.inputEntity,
            recommendedEntity: rec.entity,
            sharedThemes: rec.sharedThemes,
            affinityScore: rec.affinityScore
          }

          const result = await this.generateExplanation(explanationRequest)
          successCount++
          
          return {
            entityId: rec.entity.id || rec.entity.name,
            explanation: result.explanation,
            confidence: result.confidence,
            filtered: result.filtered
          }
        } catch (error) {
          failureCount++
          return {
            entityId: rec.entity.id || rec.entity.name,
            explanation: this.getFallbackExplanation({
              inputEntity: request.inputEntity,
              recommendedEntity: rec.entity,
              sharedThemes: rec.sharedThemes,
              affinityScore: rec.affinityScore
            }),
            confidence: 0.3,
            filtered: false
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      explanations.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(200)
      }
    }

    return {
      explanations,
      totalProcessingTime: Date.now() - startTime,
      successCount,
      failureCount
    }
  }

  /**
   * Build the prompt template for explanation generation
   */
  private buildExplanationPrompt(request: ExplanationRequest): string {
    const { inputEntity, recommendedEntity, sharedThemes, affinityScore } = request
    
    const sharedThemeNames = sharedThemes.map(theme => theme.name).join(', ')
    const affinityPercentage = Math.round(affinityScore * 100)

    return `You are a cultural taste expert explaining why someone who likes ${inputEntity.name} would enjoy ${recommendedEntity.name}.

Context:
- Input: ${inputEntity.name} (${inputEntity.type})
- Recommendation: ${recommendedEntity.name} (${recommendedEntity.type})
- Shared themes: ${sharedThemeNames}
- Cultural affinity: ${affinityPercentage}%

Write a 1-2 sentence explanation that:
1. Connects the cultural/aesthetic themes naturally
2. Uses conversational, human language (like a knowledgeable friend)
3. Avoids technical jargon or obvious statements
4. Feels insightful and makes the connection clear

Example style: "Since you appreciate Wes Anderson's meticulous visual symmetry and whimsical storytelling, you'd likely enjoy the carefully curated, vintage-modern atmosphere at Rintaro restaurant, where every dish is plated with the same obsessive attention to aesthetic detail."

Generate explanation:`
  }

  /**
   * Get fallback explanation when AI generation fails
   */
  private getFallbackExplanation(request: ExplanationRequest): string {
    const { inputEntity, recommendedEntity, sharedThemes } = request
    
    if (sharedThemes.length > 0) {
      const primaryTheme = sharedThemes[0].name
      return `Like ${inputEntity.name}, ${recommendedEntity.name} shares a similar ${primaryTheme} aesthetic that you might appreciate.`
    }
    
    return `Based on your interest in ${inputEntity.name}, you might enjoy exploring ${recommendedEntity.name} as well.`
  }

  /**
   * Calculate confidence score based on various factors
   */
  private calculateConfidence(affinityScore: number, explanation: string, filtered: boolean): number {
    if (filtered) return 0.2
    
    let confidence = affinityScore * 0.7 // Base confidence from affinity
    
    // Adjust based on explanation quality
    if (explanation.length > 50 && explanation.length < 300) {
      confidence += 0.1
    }
    
    // Check for meaningful content indicators
    const meaningfulWords = ['aesthetic', 'style', 'atmosphere', 'vibe', 'feeling', 'mood', 'theme']
    const hasMeaningfulContent = meaningfulWords.some(word => 
      explanation.toLowerCase().includes(word)
    )
    
    if (hasMeaningfulContent) {
      confidence += 0.1
    }
    
    return Math.min(Math.max(confidence, 0.1), 1.0)
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === this.retryConfig.maxRetries) {
          break
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error
        }
        
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        )
        
        await this.delay(delay)
      }
    }
    
    throw lastError!
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('rate limit') || 
             message.includes('timeout') || 
             message.includes('network') ||
             message.includes('503') ||
             message.includes('502') ||
             message.includes('500')
    }
    return false
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current model configuration
   */
  getModelInfo(): { model: string; config: any } {
    return {
      model: this.modelName,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 200,
        retryConfig: this.retryConfig
      }
    }
  }

  /**
   * Update model configuration (creates new model instance)
   */
  updateModelConfig(config: Partial<GeminiConfig>): void {
    if (config.model && config.model !== this.modelName) {
      try {
        this.modelName = config.model
        this.model = this.genAI.getGenerativeModel({ 
          model: this.modelName,
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            topK: config.topK ?? 40,
            topP: config.topP ?? 0.95,
            maxOutputTokens: config.maxOutputTokens ?? 200,
          }
        })
        console.log(`Successfully updated to model: ${this.modelName}`)
      } catch (error) {
        console.error(`Failed to update to model ${config.model}:`, error)
        throw new Error(`Invalid model configuration: ${config.model}`)
      }
    }

    if (config.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...config.retryConfig }
    }
  }

  /**
   * Get list of supported models (common Gemini models)
   */
  static getSupportedModels(): string[] {
    return [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash-exp',
      'gemini-pro',
      'gemini-pro-vision'
    ]
  }

  /**
   * Validate if a model name is likely supported
   */
  static isValidModel(modelName: string): boolean {
    return modelName.startsWith('gemini-') && modelName.length > 7
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Validate content for safety and appropriateness
   */
  async validateContent(content: string): Promise<{ safe: boolean; reason?: string }> {
    try {
      const result = await this.model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ 
            text: `Analyze this content for safety and appropriateness in a recommendation context: "${content}". Respond with only "SAFE" or "UNSAFE: [reason]"` 
          }] 
        }],
        safetySettings: this.safetySettings
      })

      const response = result.response.text().trim()
      
      if (response.startsWith('SAFE')) {
        return { safe: true }
      } else if (response.startsWith('UNSAFE:')) {
        return { safe: false, reason: response.substring(7).trim() }
      } else {
        return { safe: true } // Default to safe if unclear
      }
    } catch (error) {
      console.error('Error validating content:', error)
      return { safe: true } // Default to safe on error
    }
  }
}

// Export singleton instance (only if API key is available)
export const geminiService = process.env.GEMINI_API_KEY ? new GeminiService({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL
}) : null