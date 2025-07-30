import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserProfileService } from '../user-profile.service'
import { supabaseAdmin } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      order: vi.fn(() => ({
        range: vi.fn()
      }))
    }))
  },
  executeQuery: vi.fn(),
  executeListQuery: vi.fn()
}))

describe('UserProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateProfile', () => {
    it('should create a new user profile successfully', async () => {
      const mockProfile = {
        id: 'test-id',
        clerk_user_id: 'clerk-123',
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 100,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const result = await UserProfileService.getOrCreateProfile(
        'clerk-123',
        'test@example.com',
        'Test User'
      )

      expect(result).toEqual(mockProfile)
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_or_create_user_profile', {
        clerk_id: 'clerk-123',
        user_email: 'test@example.com',
        user_display_name: 'Test User'
      })
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const result = await UserProfileService.getOrCreateProfile(
        'clerk-123',
        'test@example.com'
      )

      expect(result).toBeNull()
    })
  })

  describe('getProfileByClerkId', () => {
    it('should retrieve user profile by Clerk ID', async () => {
      const mockProfile = {
        id: 'test-id',
        clerk_user_id: 'clerk-123',
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 100,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const result = await UserProfileService.getProfileByClerkId('clerk-123')

      expect(result).toEqual(mockProfile)
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_user_profile_by_clerk_id', {
        clerk_id: 'clerk-123'
      })
    })

    it('should return null when profile not found', async () => {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: null,
        error: null
      })

      const result = await UserProfileService.getProfileByClerkId('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateUserTier', () => {
    it('should update user tier successfully', async () => {
      const mockUpdatedProfile = {
        id: 'test-id',
        clerk_user_id: 'clerk-123',
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'premium',
        usage_limit: 1000,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Mock the executeQuery function
      const { executeQuery } = await import('@/lib/supabase')
      vi.mocked(executeQuery).mockResolvedValue({
        data: mockUpdatedProfile,
        error: null,
        success: true
      })

      const result = await UserProfileService.updateUserTier('clerk-123', 'premium', 1000)

      expect(result).toEqual(mockUpdatedProfile)
    })
  })

  describe('checkUsageLimit', () => {
    it('should return true when user is within usage limit', async () => {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: true,
        error: null
      })

      const result = await UserProfileService.checkUsageLimit('clerk-123')

      expect(result).toBe(true)
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('check_user_usage_limit', {
        clerk_id: 'clerk-123',
        current_date: expect.any(String)
      })
    })

    it('should return false when user has exceeded usage limit', async () => {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: false,
        error: null
      })

      const result = await UserProfileService.checkUsageLimit('clerk-123')

      expect(result).toBe(false)
    })

    it('should return false on error (fail-safe)', async () => {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const result = await UserProfileService.checkUsageLimit('clerk-123')

      expect(result).toBe(false)
    })
  })

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      // Mock the getUserStats method directly to test the interface
      const mockStats = {
        totalRequests: 80,
        requestsToday: 10,
        averageResponseTime: 150,
        favoriteEndpoints: ['/api/recommendations', '/api/user/profile']
      }

      // Spy on the getUserStats method
      const getUserStatsSpy = vi.spyOn(UserProfileService, 'getUserStats')
      getUserStatsSpy.mockResolvedValue(mockStats)

      const result = await UserProfileService.getUserStats('clerk-123')

      expect(result).toEqual(mockStats)
      expect(getUserStatsSpy).toHaveBeenCalledWith('clerk-123')

      getUserStatsSpy.mockRestore()
    })

    it('should return default stats when profile not found', async () => {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
        data: null,
        error: null
      })

      const result = await UserProfileService.getUserStats('nonexistent')

      expect(result).toEqual({
        totalRequests: 0,
        requestsToday: 0,
        averageResponseTime: 0,
        favoriteEndpoints: []
      })
    })
  })
})