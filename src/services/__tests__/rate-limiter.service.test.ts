import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RateLimiterService, RATE_LIMITS } from '../rate-limiter.service'
import { UserProfileService } from '../user-profile.service'
import { cacheService } from '@/lib/cache'

// Mock dependencies
vi.mock('../user-profile.service')
vi.mock('@/lib/cache')

const mockUserProfileService = vi.mocked(UserProfileService)
const mockCacheService = vi.mocked(cacheService)

describe('RateLimiterService', () => {
  const mockClerkUserId = 'user_123'
  const mockEndpoint = '/api/v1/recommendations'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkRateLimit', () => {
    it('should allow requests within free tier limits', async () => {
      // Mock user profile
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 500,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      // Mock cache to return low usage
      mockCacheService.get.mockResolvedValue(5) // 5 requests used

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.allowed).toBe(true)
      expect(result.tier).toBe('free')
      expect(result.limit).toBe(RATE_LIMITS.free.requestsPerMinute)
      expect(result.remaining).toBeGreaterThan(0)
    })

    it('should deny requests when rate limit is exceeded', async () => {
      // Mock user profile
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 500,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      // Mock cache to return usage at limit
      mockCacheService.get.mockResolvedValue(RATE_LIMITS.free.requestsPerMinute)

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should apply different limits for premium tier', async () => {
      // Mock premium user profile
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'premium@example.com',
        display_name: 'Premium User',
        tier: 'premium',
        usage_limit: 10000,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      // Mock cache to return usage within premium limits
      mockCacheService.get.mockResolvedValue(25) // 25 requests used

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.allowed).toBe(true)
      expect(result.tier).toBe('premium')
      expect(result.limit).toBe(RATE_LIMITS.premium.requestsPerMinute)
    })

    it('should handle unknown users gracefully', async () => {
      // Mock user profile not found
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(null)

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.allowed).toBe(false)
      expect(result.tier).toBe('free')
    })

    it('should fail open when rate limiting service fails', async () => {
      // Mock service failure
      mockUserProfileService.getProfileByClerkId.mockRejectedValue(new Error('Service error'))

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.allowed).toBe(true) // Fail open
    })
  })

  describe('recordRequest', () => {
    it('should increment counters for all time windows', async () => {
      // Mock cache.get to return current counts
      mockCacheService.get.mockResolvedValue(5)
      
      await RateLimiterService.recordRequest(mockClerkUserId, mockEndpoint)

      // Should call cache.get for minute, hour, day counters and burst counter
      expect(mockCacheService.get).toHaveBeenCalledTimes(4)
      // Should call cache.set at least 3 times (minute, hour, day - burst counter might fail)
      expect(mockCacheService.set).toHaveBeenCalledTimes(3)
    })

    it('should handle recording failures gracefully', async () => {
      mockCacheService.set.mockRejectedValue(new Error('Cache error'))

      // Should not throw
      await expect(
        RateLimiterService.recordRequest(mockClerkUserId, mockEndpoint)
      ).resolves.not.toThrow()
    })
  })

  describe('getUserUsageStats', () => {
    it('should return usage statistics for a user', async () => {
      // Mock user profile
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 500,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      // Mock cache responses for different time windows
      mockCacheService.get
        .mockResolvedValueOnce(5) // minute usage
        .mockResolvedValueOnce(50) // hour usage
        .mockResolvedValueOnce(200) // day usage

      const stats = await RateLimiterService.getUserUsageStats(mockClerkUserId)

      expect(stats.tier).toBe('free')
      expect(stats.minute.used).toBe(5)
      expect(stats.minute.limit).toBe(RATE_LIMITS.free.requestsPerMinute)
      expect(stats.hour.used).toBe(50)
      expect(stats.hour.limit).toBe(RATE_LIMITS.free.requestsPerHour)
      expect(stats.day.used).toBe(200)
      expect(stats.day.limit).toBe(RATE_LIMITS.free.requestsPerDay)
    })

    it('should return empty stats when user not found', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(null)
      
      // Mock cache to return 0 for all lookups
      mockCacheService.get.mockResolvedValue(0)

      const stats = await RateLimiterService.getUserUsageStats(mockClerkUserId)

      expect(stats.tier).toBe('free')
      expect(stats.minute.used).toBe(0)
      expect(stats.hour.used).toBe(0)
      expect(stats.day.used).toBe(0)
    })
  })

  describe('resetUserLimits', () => {
    it('should clear user rate limit cache', async () => {
      await RateLimiterService.resetUserLimits(mockClerkUserId)

      expect(mockCacheService.clearNamespace).toHaveBeenCalledWith(
        expect.stringContaining(mockClerkUserId)
      )
    })

    it('should throw error when cache clearing fails', async () => {
      mockCacheService.clearNamespace.mockRejectedValue(new Error('Cache error'))

      await expect(
        RateLimiterService.resetUserLimits(mockClerkUserId)
      ).rejects.toThrow('Cache error')
    })
  })

  describe('burst limit protection', () => {
    it('should prevent burst attacks', async () => {
      // Mock user profile
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 500,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      // Mock normal rate limits as OK
      mockCacheService.get
        .mockResolvedValueOnce(1) // minute usage - OK
        .mockResolvedValueOnce(1) // hour usage - OK  
        .mockResolvedValueOnce(1) // day usage - OK
        .mockResolvedValueOnce(Array(RATE_LIMITS.free.burstLimit).fill(Date.now())) // burst limit exceeded

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.allowed).toBe(false)
    })
  })

  describe('time window calculations', () => {
    it('should calculate correct reset times for different windows', async () => {
      const fixedTime = new Date('2024-01-01T12:30:45Z')
      vi.setSystemTime(fixedTime)

      // Mock user profile
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 500,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      mockCacheService.get.mockResolvedValue(1)

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.resetTime).toBeGreaterThan(fixedTime.getTime())
    })
  })

  describe('tier-based limits', () => {
    it.each([
      ['free', RATE_LIMITS.free],
      ['premium', RATE_LIMITS.premium],
      ['enterprise', RATE_LIMITS.enterprise],
    ])('should apply correct limits for %s tier', async (tier, expectedLimits) => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue({
        id: 'profile_123',
        clerk_user_id: mockClerkUserId,
        email: 'test@example.com',
        display_name: 'Test User',
        tier: tier as any,
        usage_limit: 500,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      mockCacheService.get.mockResolvedValue(1)

      const result = await RateLimiterService.checkRateLimit(mockClerkUserId, mockEndpoint)

      expect(result.tier).toBe(tier)
      expect(result.limit).toBe(expectedLimits.requestsPerMinute)
    })
  })
})