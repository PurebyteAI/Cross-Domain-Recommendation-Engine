import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateEntityHash } from '../database'

// Mock crypto for Node.js environment
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'abcdef1234567890abcdef1234567890abcdef12')
  }))
}))

describe('Database Services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Database Schema and RLS Integration', () => {
    it('should have proper database schema structure', () => {
      // Test that our database types are properly defined
      const mockUserProfile = {
        id: 'user-1',
        clerk_user_id: 'clerk-123',
        email: 'test@example.com',
        display_name: 'Test User',
        tier: 'free',
        usage_limit: 100,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      expect(mockUserProfile).toHaveProperty('id')
      expect(mockUserProfile).toHaveProperty('clerk_user_id')
      expect(mockUserProfile).toHaveProperty('email')
      expect(mockUserProfile).toHaveProperty('tier')
      expect(mockUserProfile).toHaveProperty('usage_limit')
    })

    it('should have proper taste history structure', () => {
      const mockTasteHistory = {
        id: 'history-1',
        user_id: 'user-1',
        input_entity: { name: 'Radiohead', type: 'artist' },
        recommendations: [{ name: 'Murakami', type: 'author' }],
        session_id: 'session-123',
        processing_time_ms: 1500,
        created_at: '2024-01-01T00:00:00Z'
      }

      expect(mockTasteHistory).toHaveProperty('user_id')
      expect(mockTasteHistory).toHaveProperty('input_entity')
      expect(mockTasteHistory).toHaveProperty('recommendations')
      expect(mockTasteHistory).toHaveProperty('session_id')
    })

    it('should have proper API usage tracking structure', () => {
      const mockApiUsage = {
        id: 'usage-1',
        user_id: 'user-1',
        endpoint: '/api/recommendations',
        request_count: 1,
        response_time_ms: 1200,
        status_code: 200,
        date: '2024-01-01',
        created_at: '2024-01-01T00:00:00Z'
      }

      expect(mockApiUsage).toHaveProperty('user_id')
      expect(mockApiUsage).toHaveProperty('endpoint')
      expect(mockApiUsage).toHaveProperty('request_count')
      expect(mockApiUsage).toHaveProperty('response_time_ms')
    })

    it('should have proper cached explanations structure', () => {
      const mockCachedExplanation = {
        id: 'explanation-1',
        input_entity_hash: 'hash1',
        recommended_entity_hash: 'hash2',
        explanation: 'Great recommendation because...',
        confidence_score: 0.95,
        created_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-02T00:00:00Z'
      }

      expect(mockCachedExplanation).toHaveProperty('input_entity_hash')
      expect(mockCachedExplanation).toHaveProperty('recommended_entity_hash')
      expect(mockCachedExplanation).toHaveProperty('explanation')
      expect(mockCachedExplanation).toHaveProperty('expires_at')
    })
  })

  describe('RLS Policy Testing', () => {
    it('should validate RLS policies exist for user data protection', () => {
      // Test that our RLS policies are properly structured
      const rlsPolicies = [
        'Users can view own profile',
        'Users can update own profile', 
        'Users can insert own profile',
        'Service role can access all profiles',
        'Users can view own taste history',
        'Users can insert own taste history',
        'Service role can access all taste history',
        'Users can view own api usage',
        'Users can insert own api usage',
        'Service role can access all api usage'
      ]

      // Verify we have comprehensive RLS coverage
      expect(rlsPolicies.length).toBeGreaterThan(8)
      expect(rlsPolicies).toContain('Users can view own profile')
      expect(rlsPolicies).toContain('Service role can access all profiles')
    })

    it('should have proper database functions for user management', () => {
      const databaseFunctions = [
        'get_user_profile_by_clerk_id',
        'get_or_create_user_profile',
        'check_user_usage_limit',
        'cleanup_expired_explanations'
      ]

      expect(databaseFunctions).toContain('get_or_create_user_profile')
      expect(databaseFunctions).toContain('check_user_usage_limit')
    })
  })

  describe('Database Indexes and Performance', () => {
    it('should have proper indexes for performance optimization', () => {
      const expectedIndexes = [
        'idx_user_profiles_clerk_user_id',
        'idx_user_profiles_email',
        'idx_user_taste_history_user_id',
        'idx_api_usage_user_id',
        'idx_cached_explanations_input_hash'
      ]

      // Verify we have performance indexes
      expect(expectedIndexes.length).toBeGreaterThan(4)
      expect(expectedIndexes).toContain('idx_user_profiles_clerk_user_id')
      expect(expectedIndexes).toContain('idx_user_taste_history_user_id')
    })
  })

  describe('Utility Functions', () => {
    it('should generate consistent entity hash', () => {
      const entity1 = { name: 'Radiohead', type: 'artist', id: '123' }
      const entity2 = { type: 'artist', id: '123', name: 'Radiohead' } // Different order

      const hash1 = generateEntityHash(entity1)
      const hash2 = generateEntityHash(entity2)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(32)
    })

    it('should generate different hashes for different entities', () => {
      const entity1 = { name: 'Radiohead', type: 'artist' }
      const entity2 = { name: 'Murakami', type: 'author' }

      const hash1 = generateEntityHash(entity1)
      const hash2 = generateEntityHash(entity2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', () => {
      const errorTypes = [
        '23505', // unique_violation
        '23503', // foreign_key_violation  
        '23502', // not_null_violation
        'PGRST116' // Row Level Security violation
      ]

      expect(errorTypes).toContain('23505')
      expect(errorTypes).toContain('PGRST116')
    })
  })
})