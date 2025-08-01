import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { RecommendationEngine } from '@/services/recommendation-engine'
import { createCachedQlooService } from '@/services/cached-qloo.service'
import { GeminiService } from '@/services/gemini.service'
import { UsageTrackingService } from '@/services/usage-tracking.service'
import { UserProfileService } from '@/services/user-profile.service'
import { RateLimiterService } from '@/services/rate-limiter.service'
import { RecommendationRequest, RecommendationResponse, ErrorResponse, EntityType } from '@/types'
import { ApiErrorMiddleware, ErrorResponseUtils } from '@/lib/error-middleware'
import { ErrorUtils } from '@/lib/error-handler'
import { GracefulDegradationService } from '@/services/graceful-degradation.service'

// Validation schema for recommendation requests
const EntitySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Entity name is required'),
  type: z.enum(['movie', 'book', 'song', 'artist', 'restaurant', 'brand', 'tv_show', 'podcast', 'game'] as const),
  metadata: z.record(z.string(), z.unknown()).optional()
})

const RecommendationRequestSchema = z.object({
  entities: z.array(EntitySchema).min(1, 'At least one entity is required').max(5, 'Maximum 5 entities allowed'),
  domains: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional().default(5),
  includeExplanations: z.boolean().optional().default(true)
})

// Initialize services
let recommendationEngine: RecommendationEngine | null = null

function getRecommendationEngine(): RecommendationEngine {
  if (!recommendationEngine) {
    if (!process.env.QLOO_API_KEY || !process.env.GEMINI_API_KEY) {
      throw new Error('Required API keys not configured')
    }

    const qlooService = createCachedQlooService()

    const geminiService = new GeminiService({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    })

    recommendationEngine = new RecommendationEngine({
      qlooService,
      geminiService,
      defaultLimit: 5,
      confidenceThreshold: 0.3,
      maxCrossDomainResults: 50
    })
  }

  return recommendationEngine
}

/**
 * Fallback handler for when external services are unavailable
 */
async function handleRecommendationsFallback(
  error: unknown,
  request: NextRequest
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  
  console.warn('[API] Using fallback for recommendations due to external service error:', error)
  
  try {
    // Get authenticated user for cached recommendations
    const { userId } = await auth()
    
    // Parse request body to get the original request
    const body = await request.json()
    const validationResult = RecommendationRequestSchema.safeParse(body)
    
    if (validationResult.success) {
      const recommendationRequest = validationResult.data
      
      // Try to get cached recommendations first
      if (userId) {
        const cachedResponse = await GracefulDegradationService.getCachedRecommendations(
          recommendationRequest,
          userId
        )
        
        if (cachedResponse) {
          console.log('[API] Returning cached recommendations as fallback')
          return NextResponse.json({
            ...cachedResponse,
            fallback: true,
            fallbackReason: 'External services unavailable - using cached results'
          })
        }
      }
      
      // If no cached results, get popular fallback recommendations
      const fallbackResponse = await GracefulDegradationService.getFallbackRecommendations(
        recommendationRequest
      )
      
      console.log('[API] Returning popular recommendations as fallback')
      return NextResponse.json({
        ...fallbackResponse,
        fallback: true,
        fallbackReason: 'External services unavailable - using popular recommendations'
      })
    }
  } catch (fallbackError) {
    console.error('[API] Fallback handler also failed:', fallbackError)
  }
  
  // Last resort: return error message
  return ApiErrorMiddleware.createFallbackResponse(
    requestId,
    'Our recommendation service is temporarily experiencing issues. Please try again in a few minutes.',
    503
  )
}

/**
 * Main POST handler with centralized error handling and graceful degradation
 */
async function handleRecommendationsPost(request: NextRequest): Promise<NextResponse> {
  // Get authenticated user
  const { userId } = await auth()
  if (!userId) {
    throw ErrorUtils.authenticationRequired()
  }

  // Parse and validate request body first (lightweight operation)
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    throw ErrorUtils.validationError(
      'Invalid JSON in request body',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )
  }

  // Validate request schema
  const validationResult = RecommendationRequestSchema.safeParse(body)
  if (!validationResult.success) {
    throw ErrorUtils.validationError(
      'Invalid request format',
      {
        errors: validationResult.error.issues.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      }
    )
  }

  const recommendationRequest: RecommendationRequest = validationResult.data

  // Check rate limits before any expensive operations
  const rateLimitResult = await RateLimiterService.checkRateLimit(userId, 'recommendations')
  if (!rateLimitResult.allowed) {
    // Instead of returning an error, provide graceful degradation
    console.log(`[API] User ${userId} hit rate limit for tier ${rateLimitResult.tier}, providing cached/fallback recommendations`)
    
    const rateLimitedResponse = await GracefulDegradationService.getRateLimitedRecommendations(
      recommendationRequest,
      userId,
      rateLimitResult.tier
    )
    
    return NextResponse.json(rateLimitedResponse, { 
      status: 200, // Return 200 instead of 429 since we're providing value
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        'X-Rate-Limited': 'true'
      }
    })
  }

  // Get user profile for tier checking
  const userProfile = await UserProfileService.getProfileByClerkId(userId)
  if (!userProfile) {
    throw ErrorUtils.userNotFound()
  }

  // Check usage limits based on user tier
  const hasUsageRemaining = await UserProfileService.checkUsageLimit(userId)
  if (!hasUsageRemaining) {
    throw ErrorUtils.usageLimitExceeded({
      tier: userProfile.tier,
      limit: userProfile.usage_limit
    })
  }

  // Get recommendation engine
  const engine = getRecommendationEngine()

  // Generate personalized recommendations
  console.log(`[API] Generating personalized recommendations for user ${userId}:`, recommendationRequest)
  const startTime = Date.now()
  const response = await engine.generatePersonalizedRecommendations({
    ...recommendationRequest,
    userId: userProfile.id,
    sessionId: crypto.randomUUID(),
    personalize: true
  })
  const responseTime = Date.now() - startTime

  // Track usage
  await UsageTrackingService.trackRequest({
    clerkUserId: userId,
    endpoint: '/api/v1/recommendations',
    method: 'POST',
    statusCode: 200,
    responseTimeMs: responseTime,
    userAgent: request.headers.get('user-agent') || undefined,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    metadata: {
      entityCount: recommendationRequest.entities.length,
      domains: recommendationRequest.domains,
      includeExplanations: recommendationRequest.includeExplanations
    }
  })

  console.log(`[API] Successfully generated recommendations in ${responseTime}ms`)

  return NextResponse.json(response)
}

/**
 * POST /api/v1/recommendations
 * Generate cross-domain recommendations with explanations
 * Requirements: 3.1, 3.2, 3.3
 */
export const POST = ApiErrorMiddleware.withGracefulDegradation(
  handleRecommendationsPost,
  handleRecommendationsFallback
)

/**
 * GET /api/v1/recommendations
 * Get API documentation and usage information
 */
export async function GET() {
  return NextResponse.json({
    name: 'Cross-Domain Recommendation API',
    version: '1.0.0',
    description: 'Generate cross-domain taste-based recommendations with explanations',
    endpoints: {
      'POST /api/v1/recommendations': {
        description: 'Generate cross-domain recommendations',
        authentication: 'Required (Clerk)',
        rateLimit: 'Based on user tier',
        requestBody: {
          entities: 'Array of 1-5 entities with name, type, and optional id/metadata',
          domains: 'Optional array of domains to filter results',
          limit: 'Optional number of recommendations per domain (1-20, default: 5)',
          includeExplanations: 'Optional boolean to include explanations (default: true)'
        },
        response: {
          success: 'Boolean indicating success',
          input: 'Echo of input entities',
          recommendations: 'Object with domain keys and recommendation arrays',
          processingTime: 'Processing time in milliseconds',
          cached: 'Boolean indicating if results were cached'
        }
      }
    },
    supportedEntityTypes: [
      'movie', 'book', 'song', 'artist', 'restaurant', 'brand', 'tv_show', 'podcast', 'game'
    ],
    supportedDomains: [
      'movie', 'book', 'song', 'artist', 'restaurant', 'brand', 'tv_show', 'podcast', 'game'
    ],
    examples: {
      singleEntity: {
        entities: [
          { name: 'Radiohead', type: 'artist' }
        ]
      },
      multipleEntities: {
        entities: [
          { name: 'Inception', type: 'movie' },
          { name: 'The Dark Knight', type: 'movie' }
        ],
        domains: ['book', 'song', 'restaurant'],
        limit: 3
      }
    }
  })
}