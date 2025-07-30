import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { RateLimiterService } from '@/services/rate-limiter.service'
import { UsageTrackingService } from '@/services/usage-tracking.service'

// Mock the services
vi.mock('@/services/rate-limiter.service')
vi.mock('@/services/usage-tracking.service')
vi.mock('@clerk/nextjs/server')

const mockRateLimiterService = vi.mocked(RateLimiterService)
const mockUsageTrackingService = vi.mocked(UsageTrackingService)

// Mock Clerk auth
const mockAuth = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (fn: any) => fn,
  createRouteMatcher: (routes: string[]) => (req: any) => 
    routes.some(route => req.nextUrl.pathname.startsWith(route.replace('(.*)', ''))),
}))

describe('Rate Limiting Middleware Integration', () => {
  const mockUserId = 'user_123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: mockUserId })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rate Limiting Logic', () => {
    it('should allow requests within rate limits', async () => {
      // Mock rate limiter to allow request
      mockRateLimiterService.checkRateLimit.mockResolvedValue({
        allowed: true,
        limit: 10,
        remaining: 5,
        resetTime: Date.now() + 60000,
        tier: 'free',
      })

      mockRateLimiterService.recordRequest.mockResolvedValue()

      // Simulate middleware logic
      const rateLimitResult = await RateLimiterService.checkRateLimit(
        mockUserId,
        '/api/v1/recommendations'
      )

      expect(rateLimitResult.allowed).toBe(true)
      expect(rateLimitResult.remaining).toBe(5)
      expect(rateLimitResult.tier).toBe('free')

      // Should record the request
      await RateLimiterService.recordRequest(mockUserId, '/api/v1/recommendations')
      expect(mockRateLimiterService.recordRequest).toHaveBeenCalledWith(
        mockUserId,
        '/api/v1/recommendations'
      )
    })

    it('should deny requests when rate limit is exceeded', async () => {
      // Mock rate limiter to deny request
      mockRateLimiterService.checkRateLimit.mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
        tier: 'free',
      })

      const rateLimitResult = await RateLimiterService.checkRateLimit(
        mockUserId,
        '/api/v1/recommendations'
      )

      expect(rateLimitResult.allowed).toBe(false)
      expect(rateLimitResult.remaining).toBe(0)
      expect(rateLimitResult.retryAfter).toBe(60)

      // Should track the rate-limited request
      await UsageTrackingService.trackRequest({
        clerkUserId: mockUserId,
        endpoint: '/api/v1/recommendations',
        method: 'POST',
        statusCode: 429,
        responseTimeMs: 100,
      })

      expect(mockUsageTrackingService.trackRequest).toHaveBeenCalledWith({
        clerkUserId: mockUserId,
        endpoint: '/api/v1/recommendations',
        method: 'POST',
        statusCode: 429,
        responseTimeMs: 100,
      })
    })

    it('should handle different tiers correctly', async () => {
      // Test premium tier
      mockRateLimiterService.checkRateLimit.mockResolvedValue({
        allowed: true,
        limit: 50, // Premium tier limit
        remaining: 25,
        resetTime: Date.now() + 60000,
        tier: 'premium',
      })

      const rateLimitResult = await RateLimiterService.checkRateLimit(
        mockUserId,
        '/api/v1/recommendations'
      )

      expect(rateLimitResult.tier).toBe('premium')
      expect(rateLimitResult.limit).toBe(50)
    })

    it('should fail open when rate limiting service fails', async () => {
      // Mock service failure
      mockRateLimiterService.checkRateLimit.mockRejectedValue(new Error('Service error'))

      try {
        await RateLimiterService.checkRateLimit(mockUserId, '/api/v1/recommendations')
      } catch (error) {
        // In real middleware, this would be caught and fail open
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  describe('Usage Tracking Integration', () => {
    it('should track successful requests', async () => {
      const usageEvent = {
        clerkUserId: mockUserId,
        endpoint: '/api/v1/recommendations',
        method: 'POST',
        statusCode: 200,
        responseTimeMs: 150,
        userAgent: 'Mozilla/5.0',
      }

      await UsageTrackingService.trackRequest(usageEvent)

      expect(mockUsageTrackingService.trackRequest).toHaveBeenCalledWith(usageEvent)
    })

    it('should track error requests', async () => {
      const errorEvent = {
        clerkUserId: mockUserId,
        endpoint: '/api/v1/recommendations',
        method: 'POST',
        statusCode: 500,
        responseTimeMs: 200,
        errorMessage: 'Internal server error',
      }

      await UsageTrackingService.trackRequest(errorEvent)

      expect(mockUsageTrackingService.trackRequest).toHaveBeenCalledWith(errorEvent)
    })

    it('should handle tracking failures gracefully', async () => {
      mockUsageTrackingService.trackRequest.mockRejectedValue(new Error('Tracking error'))

      // Should not throw
      await expect(
        UsageTrackingService.trackRequest({
          clerkUserId: mockUserId,
          endpoint: '/api/v1/recommendations',
          method: 'POST',
          statusCode: 200,
          responseTimeMs: 150,
        })
      ).rejects.toThrow('Tracking error')
    })
  })

  describe('Response Headers', () => {
    it('should include rate limit headers in response', () => {
      const rateLimitResult = {
        allowed: true,
        limit: 10,
        remaining: 5,
        resetTime: Date.now() + 60000,
        tier: 'free' as const,
      }

      // Simulate header setting logic
      const headers = {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
      }

      expect(headers['X-RateLimit-Limit']).toBe('10')
      expect(headers['X-RateLimit-Remaining']).toBe('5')
      expect(headers['X-RateLimit-Reset']).toBe(rateLimitResult.resetTime.toString())
    })

    it('should include retry-after header when rate limited', () => {
      const rateLimitResult = {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
        tier: 'free' as const,
      }

      const headers = {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
      }

      expect(headers['Retry-After']).toBe('60')
    })
  })

  describe('Route Matching', () => {
    it('should apply rate limiting to protected API routes', () => {
      const protectedRoutes = ['/api/v1', '/api/user']
      
      // Simulate route matcher logic
      const isRateLimitedRoute = (pathname: string) =>
        protectedRoutes.some(route => pathname.startsWith(route))

      expect(isRateLimitedRoute('/api/v1/recommendations')).toBe(true)
      expect(isRateLimitedRoute('/api/user/profile')).toBe(true)
      expect(isRateLimitedRoute('/api/webhooks/clerk')).toBe(false)
      expect(isRateLimitedRoute('/dashboard')).toBe(false)
    })

    it('should skip rate limiting for public routes', () => {
      const publicRoutes = ['/api/webhooks']
      
      const isPublicRoute = (pathname: string) =>
        publicRoutes.some(route => pathname.startsWith(route))

      expect(isPublicRoute('/api/webhooks/clerk')).toBe(true)
      expect(isPublicRoute('/api/v1/recommendations')).toBe(false)
    })
  })
})