import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { UsageTrackingService, UsageEvent } from '../usage-tracking.service'
import { UserProfileService } from '../user-profile.service'
import { supabaseAdmin } from '@/lib/supabase'

// Mock dependencies
vi.mock('../user-profile.service')
vi.mock('@/lib/supabase')

const mockUserProfileService = vi.mocked(UserProfileService)
const mockSupabaseAdmin = vi.mocked(supabaseAdmin)

describe('UsageTrackingService', () => {
  const mockClerkUserId = 'user_123'
  const mockUserProfile = {
    id: 'profile_123',
    clerk_user_id: mockClerkUserId,
    email: 'test@example.com',
    display_name: 'Test User',
    tier: 'free',
    usage_limit: 500,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockUsageEvent: UsageEvent = {
    clerkUserId: mockClerkUserId,
    endpoint: '/api/v1/recommendations',
    method: 'POST',
    statusCode: 200,
    responseTimeMs: 150,
    userAgent: 'Mozilla/5.0',
    ipAddress: '192.168.1.1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('trackRequest', () => {
    it('should track a successful request', async () => {
      // Mock user profile lookup
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      // Mock database inserts
      const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null })
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        insert: mockInsert,
      })

      await UsageTrackingService.trackRequest(mockUsageEvent)

      expect(mockUserProfileService.getProfileByClerkId).toHaveBeenCalledWith(mockClerkUserId)
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('api_usage')
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('system_metrics')
      expect(mockInsert).toHaveBeenCalled()
    })

    it('should track error requests with error metrics', async () => {
      const errorEvent: UsageEvent = {
        ...mockUsageEvent,
        statusCode: 500,
        errorMessage: 'Internal server error',
      }

      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null })
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        insert: mockInsert,
      })

      await UsageTrackingService.trackRequest(errorEvent)

      // Should be called for api_usage and system_metrics (including error metric)
      expect(mockInsert).toHaveBeenCalledTimes(4)
    })

    it('should handle missing user profile gracefully', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(null)

      // Should not throw
      await expect(
        UsageTrackingService.trackRequest(mockUsageEvent)
      ).resolves.not.toThrow()

      // Should not attempt database operations
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      const mockInsert = vi.fn().mockRejectedValue(new Error('Database error'))
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        insert: mockInsert,
      })

      // Should not throw
      await expect(
        UsageTrackingService.trackRequest(mockUsageEvent)
      ).resolves.not.toThrow()
    })
  })

  describe('trackRequestsBatch', () => {
    it('should track multiple requests efficiently', async () => {
      const events: UsageEvent[] = [
        mockUsageEvent,
        { ...mockUsageEvent, endpoint: '/api/v1/search' },
        { ...mockUsageEvent, statusCode: 404 },
      ]

      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null })
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        insert: mockInsert,
      })

      await UsageTrackingService.trackRequestsBatch(events)

      expect(mockUserProfileService.getProfileByClerkId).toHaveBeenCalledTimes(1) // Cached lookup
      expect(mockInsert).toHaveBeenCalledTimes(2) // api_usage and system_metrics
    })

    it('should handle empty batch', async () => {
      await UsageTrackingService.trackRequestsBatch([])

      expect(mockUserProfileService.getProfileByClerkId).not.toHaveBeenCalled()
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled()
    })
  })

  describe('getUserAnalytics', () => {
    it('should return user analytics', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      // Mock database queries
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: [
                {
                  endpoint: '/api/v1/recommendations',
                  request_count: 10,
                  response_time_ms: 150,
                  status_code: 200,
                  date: '2024-01-01',
                  created_at: '2024-01-01T12:00:00Z',
                },
                {
                  endpoint: '/api/v1/search',
                  request_count: 5,
                  response_time_ms: 100,
                  status_code: 200,
                  date: '2024-01-01',
                  created_at: '2024-01-01T13:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      })

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: mockSelect,
      })

      const analytics = await UsageTrackingService.getUserAnalytics(mockClerkUserId)

      expect(analytics.totalRequests).toBe(15)
      expect(analytics.requestsToday).toBe(15)
      expect(analytics.averageResponseTime).toBe(125) // (150 + 100) / 2
      expect(analytics.errorRate).toBe(0)
      expect(analytics.topEndpoints).toHaveLength(2)
      expect(analytics.topEndpoints[0].endpoint).toBe('/api/v1/recommendations')
      expect(analytics.topEndpoints[0].count).toBe(10)
    })

    it('should return empty analytics for unknown user', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(null)

      const analytics = await UsageTrackingService.getUserAnalytics(mockClerkUserId)

      expect(analytics.totalRequests).toBe(0)
      expect(analytics.requestsToday).toBe(0)
      expect(analytics.averageResponseTime).toBe(0)
      expect(analytics.errorRate).toBe(0)
      expect(analytics.topEndpoints).toHaveLength(0)
    })

    it('should calculate error rate correctly', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: [
                {
                  endpoint: '/api/v1/recommendations',
                  request_count: 8,
                  response_time_ms: 150,
                  status_code: 200,
                  date: '2024-01-01',
                  created_at: '2024-01-01T12:00:00Z',
                },
                {
                  endpoint: '/api/v1/recommendations',
                  request_count: 2,
                  response_time_ms: 500,
                  status_code: 500,
                  date: '2024-01-01',
                  created_at: '2024-01-01T12:30:00Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      })

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: mockSelect,
      })

      const analytics = await UsageTrackingService.getUserAnalytics(mockClerkUserId)

      expect(analytics.totalRequests).toBe(10)
      expect(analytics.errorRate).toBe(20) // 2 errors out of 10 requests = 20%
    })
  })

  describe('getSystemAnalytics', () => {
    it('should return system-wide analytics', async () => {
      // Mock database query with user profiles joined
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: [
              {
                endpoint: '/api/v1/recommendations',
                request_count: 100,
                response_time_ms: 150,
                status_code: 200,
                date: '2024-01-01',
                created_at: '2024-01-01T12:00:00Z',
                user_profiles: { tier: 'free' },
              },
              {
                endpoint: '/api/v1/search',
                request_count: 50,
                response_time_ms: 100,
                status_code: 200,
                date: '2024-01-01',
                created_at: '2024-01-01T13:00:00Z',
                user_profiles: { tier: 'premium' },
              },
            ],
            error: null,
          }),
        }),
      })

      // Mock user profiles query
      const mockUserSelect = vi.fn().mockResolvedValue({
        data: [
          { tier: 'free' },
          { tier: 'free' },
          { tier: 'premium' },
        ],
        error: null,
      })

      mockSupabaseAdmin.from = vi.fn()
        .mockReturnValueOnce({ select: mockSelect }) // First call for usage data
        .mockReturnValueOnce({ select: mockUserSelect }) // Second call for user stats

      const analytics = await UsageTrackingService.getSystemAnalytics()

      expect(analytics.totalRequests).toBe(150)
      expect(analytics.userCount).toBe(3)
      expect(analytics.tierDistribution.free).toBe(2)
      expect(analytics.tierDistribution.premium).toBe(1)
      expect(analytics.requestsByTier.free).toBe(100)
      expect(analytics.requestsByTier.premium).toBe(50)
    })

    it('should handle empty system data', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      const mockUserSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockSupabaseAdmin.from = vi.fn()
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ select: mockUserSelect })

      const analytics = await UsageTrackingService.getSystemAnalytics()

      expect(analytics.totalRequests).toBe(0)
      expect(analytics.userCount).toBe(0)
      expect(analytics.tierDistribution).toEqual({})
    })
  })

  describe('cleanupOldData', () => {
    it('should clean up old usage data', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: '1' }, { id: '2' }],
            error: null,
          }),
        }),
      })

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        delete: mockDelete,
      })

      const deletedCount = await UsageTrackingService.cleanupOldData(30)

      expect(deletedCount).toBe(4) // 2 from api_usage + 2 from system_metrics
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('api_usage')
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('system_metrics')
    })

    it('should handle cleanup errors gracefully', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      })

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        delete: mockDelete,
      })

      const deletedCount = await UsageTrackingService.cleanupOldData(30)

      expect(deletedCount).toBe(0)
    })
  })

  describe('response time percentiles', () => {
    it('should calculate percentiles correctly', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      // Mock data with known response times
      const responseTimes = [100, 150, 200, 250, 300, 400, 500, 600, 700, 1000]
      const mockData = responseTimes.map((time, index) => ({
        endpoint: '/api/v1/test',
        request_count: 1,
        response_time_ms: time,
        status_code: 200,
        date: '2024-01-01',
        created_at: `2024-01-01T${String(index).padStart(2, '0')}:00:00Z`,
      }))

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      })

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: mockSelect,
      })

      const analytics = await UsageTrackingService.getUserAnalytics(mockClerkUserId)

      expect(analytics.responseTimePercentiles.p50).toBe(300) // 50th percentile
      expect(analytics.responseTimePercentiles.p95).toBe(1000) // 95th percentile
      expect(analytics.responseTimePercentiles.p99).toBe(1000) // 99th percentile
    })

    it('should handle empty response times', async () => {
      mockUserProfileService.getProfileByClerkId.mockResolvedValue(mockUserProfile)

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      })

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: mockSelect,
      })

      const analytics = await UsageTrackingService.getUserAnalytics(mockClerkUserId)

      expect(analytics.responseTimePercentiles.p50).toBe(0)
      expect(analytics.responseTimePercentiles.p95).toBe(0)
      expect(analytics.responseTimePercentiles.p99).toBe(0)
    })
  })
})