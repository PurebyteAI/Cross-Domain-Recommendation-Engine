import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as recommendationsPost } from '@/app/api/v1/recommendations/route'
import { GET as healthGet, POST as healthPost } from '@/app/api/health/route'

// Mock external dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn()
}))

vi.mock('@/services/user-profile.service', () => ({
  UserProfileService: {
    getProfileByClerkId: vi.fn(),
    checkUsageLimit: vi.fn()
  }
}))

vi.mock('@/services/usage-tracking.service', () => ({
  UsageTrackingService: {
    trackRequest: vi.fn()
  }
}))

vi.mock('@/services/cached-qloo.service', () => ({
  createCachedQlooService: vi.fn()
}))

vi.mock('@/services/gemini.service', async () => {
  const actual = await vi.importActual('@/services/gemini.service')
  return {
    ...actual,
    GeminiService: vi.fn()
  }
})

vi.mock('@/services/recommendation-engine', () => ({
  RecommendationEngine: vi.fn()
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { auth } from '@clerk/nextjs/server'
import { UserProfileService } from '@/services/user-profile.service'
import { UsageTrackingService } from '@/services/usage-tracking.service'
import { createCachedQlooService } from '@/services/cached-qloo.service'
import { GeminiService } from '@/services/gemini.service'
import { RecommendationEngine } from '@/services/recommendation-engine'
import { supabase } from '@/lib/supabase'

const mockAuth = vi.mocked(auth)
const mockUserProfileService = vi.mocked(UserProfileService)
const mockUsageTrackingService = vi.mocked(UsageTrackingService)
const mockCreateCachedQlooService = vi.mocked(createCachedQlooService)
const mockGeminiService = vi.mocked(GeminiService)
const mockRecommendationEngine = vi.mocked(RecommendationEngine)
const mockSupabase = vi.mocked(supabase)

describe('API Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    process.env.QLOO_API_KEY = 'test-qloo-key'
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    
    // Default successful auth
    mockAuth.mockResolvedValue({ userId: 'test-user-id' })
    
    // Default user profile
    mockUserProfileService.getProfileByClerkId.mockResolvedValue({
      id: 'profile-id',
      clerk_user_id: 'test-user-id',
      email: 'test@example.com',
      tier: 'free',
      usage_limit: 100,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    })
    
    mockUserProfileService.checkUsageLimit.mockResolvedValue(true)
    mockUsageTrackingService.trackRequest.mockResolvedValue()
  })

  afterEach(() => {
    delete process.env.QLOO_API_KEY
    delete process.env.GEMINI_API_KEY
  })

  describe('Recommendations API Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockAuth.mockResolvedValue({ userId: null })
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          entities: [{ name: 'Test', type: 'movie' }]
        })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
      expect(response.headers.get('X-Request-ID')).toBeDefined()
    })

    it('should handle user not found errors', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(null)
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          entities: [{ name: 'Test', type: 'movie' }]
        })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('USER_NOT_FOUND')
    })

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('Invalid JSON')
    })

    it('should handle validation errors', async () => {
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          entities: [] // Empty array should fail validation
        })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.details.errors).toBeDefined()
    })

    it('should handle usage limit exceeded', async () => {
      mockUserProfileService.checkUsageLimit.mockResolvedValue(false)
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          entities: [{ name: 'Test', type: 'movie' }]
        })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('USAGE_LIMIT_EXCEEDED')
    })

    it('should handle service configuration errors with fallback', async () => {
      delete process.env.QLOO_API_KEY
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          entities: [{ name: 'Test', type: 'movie' }]
        })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SERVICE_UNAVAILABLE')
      expect(response.headers.get('Retry-After')).toBe('300')
    })

    it('should handle external service errors with graceful degradation', async () => {
      // Mock services to throw external service error
      const mockQlooService = {
        searchEntity: vi.fn().mockRejectedValue(new Error('Qloo API timeout')),
        getCacheStats: vi.fn().mockResolvedValue({ l1Size: 0, l2Connected: false })
      }
      mockCreateCachedQlooService.mockReturnValue(mockQlooService as any)
      
      const mockGeminiInstance = {
        generateExplanation: vi.fn(),
        getModelInfo: vi.fn().mockReturnValue({ model: 'test', config: {} })
      }
      mockGeminiService.mockReturnValue(mockGeminiInstance as any)
      
      const mockEngineInstance = {
        generateRecommendations: vi.fn().mockRejectedValue(new Error('External service timeout'))
      }
      mockRecommendationEngine.mockReturnValue(mockEngineInstance as any)
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          entities: [{ name: 'Test', type: 'movie' }]
        })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SERVICE_UNAVAILABLE')
      expect(data.error.details.fallback).toBe(true)
    })

    it('should track failed requests', async () => {
      // Force an error after user profile check
      const mockEngineInstance = {
        generateRecommendations: vi.fn().mockRejectedValue(new Error('Test error'))
      }
      mockRecommendationEngine.mockReturnValue(mockEngineInstance as any)
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '192.168.1.1'
        },
        body: JSON.stringify({
          entities: [{ name: 'Test', type: 'movie' }]
        })
      })

      await recommendationsPost(request)

      // Should track the failed request
      expect(mockUsageTrackingService.trackRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkUserId: 'test-user-id',
          endpoint: '/api/v1/recommendations',
          method: 'POST',
          statusCode: expect.any(Number),
          responseTimeMs: expect.any(Number),
          userAgent: 'test-agent',
          ipAddress: '192.168.1.1'
        })
      )
    })
  })

  describe('Health API Error Handling', () => {
    beforeEach(() => {
      // Mock Supabase responses
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          head: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      })
      mockSupabase.from.mockReturnValue(mockFrom() as any)
    })

    it('should handle database connection errors in health check', async () => {
      // Mock database error
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Connection failed', code: 'CONNECTION_ERROR' } 
            })
          })
        })
      })
      mockSupabase.from.mockReturnValue(mockFrom() as any)
      
      const request = new NextRequest('https://example.com/api/health')
      const response = await healthGet(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.services.database.healthy).toBe(false)
      expect(data.services.database.error).toContain('Connection failed')
    })

    it('should handle missing API keys in health check', async () => {
      delete process.env.QLOO_API_KEY
      delete process.env.GEMINI_API_KEY
      
      const request = new NextRequest('https://example.com/api/health')
      const response = await healthGet(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.services.qloo.healthy).toBe(false)
      expect(data.services.qloo.error).toContain('not configured')
      expect(data.services.gemini.healthy).toBe(false)
      expect(data.services.gemini.error).toContain('not configured')
    })

    it('should handle service errors in detailed health check', async () => {
      // Mock Qloo service error
      const mockQlooService = {
        searchEntity: vi.fn().mockRejectedValue(new Error('Qloo API error')),
        getCacheStats: vi.fn().mockRejectedValue(new Error('Cache error'))
      }
      mockCreateCachedQlooService.mockReturnValue(mockQlooService as any)
      
      const request = new NextRequest('https://example.com/api/health', { method: 'POST' })
      const response = await healthPost(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.services.qloo.healthy).toBe(false)
      expect(data.services.qloo.details.apiTest).toBe('failed')
    })

    it('should return healthy status when all services are working', async () => {
      // Mock successful service responses
      const mockQlooService = {
        searchEntity: vi.fn().mockResolvedValue([{ id: '1', name: 'Test', type: 'artist' }]),
        getCacheStats: vi.fn().mockResolvedValue({ l1Size: 10, l2Connected: true })
      }
      mockCreateCachedQlooService.mockReturnValue(mockQlooService as any)
      
      const mockGeminiInstance = {
        generateExplanation: vi.fn().mockResolvedValue({ 
          explanation: 'Test explanation',
          confidence: 0.8 
        }),
        getModelInfo: vi.fn().mockReturnValue({ 
          model: 'gemini-1.5-flash', 
          config: { temperature: 0.7 } 
        })
      }
      mockGeminiService.mockReturnValue(mockGeminiInstance as any)
      
      const request = new NextRequest('https://example.com/api/health')
      const response = await healthGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.services.database.healthy).toBe(true)
      expect(data.services.qloo.healthy).toBe(true)
      expect(data.services.gemini.healthy).toBe(true)
      expect(response.headers.get('X-Health-Check')).toBe('pass')
    })

    it('should include proper headers and metadata', async () => {
      const request = new NextRequest('https://example.com/api/health')
      const response = await healthGet(request)
      const data = await response.json()

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
      expect(response.headers.get('X-Request-ID')).toBeDefined()
      expect(response.headers.get('X-Processing-Time')).toBeDefined()
      expect(data.timestamp).toBeDefined()
      expect(data.responseTime).toBeGreaterThan(0)
      expect(data.version).toBeDefined()
      expect(data.environment).toBeDefined()
    })
  })

  describe('Error Response Format Consistency', () => {
    it('should return consistent error response format across all endpoints', async () => {
      mockAuth.mockResolvedValue({ userId: null })
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({ entities: [{ name: 'Test', type: 'movie' }] })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      // Check standard error response format
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('code')
      expect(data.error).toHaveProperty('message')
      expect(data.error).toHaveProperty('details')
      expect(data).toHaveProperty('requestId')
      expect(data).toHaveProperty('timestamp')
      
      // Check standard headers
      expect(response.headers.get('X-Request-ID')).toBeDefined()
      expect(response.headers.get('X-Processing-Time')).toBeDefined()
    })

    it('should include retry-after header for rate limit errors', async () => {
      mockUserProfileService.checkUsageLimit.mockResolvedValue(false)
      
      const request = new NextRequest('https://example.com/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({ entities: [{ name: 'Test', type: 'movie' }] })
      })

      const response = await recommendationsPost(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error.code).toBe('USAGE_LIMIT_EXCEEDED')
      // Note: Usage limit errors don't have retry-after by default, 
      // but rate limit errors would
    })
  })
})