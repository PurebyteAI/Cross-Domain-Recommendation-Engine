import { describe, it, expect } from 'vitest'
import { hasPermission, getUsageLimits } from '../auth'

describe('Auth utilities', () => {
  describe('hasPermission', () => {
    it('should allow free tier users to access free features', () => {
      expect(hasPermission('free', 'free')).toBe(true)
    })

    it('should not allow free tier users to access premium features', () => {
      expect(hasPermission('free', 'premium')).toBe(false)
    })

    it('should not allow free tier users to access enterprise features', () => {
      expect(hasPermission('free', 'enterprise')).toBe(false)
    })

    it('should allow premium tier users to access free and premium features', () => {
      expect(hasPermission('premium', 'free')).toBe(true)
      expect(hasPermission('premium', 'premium')).toBe(true)
    })

    it('should not allow premium tier users to access enterprise features', () => {
      expect(hasPermission('premium', 'enterprise')).toBe(false)
    })

    it('should allow enterprise tier users to access all features', () => {
      expect(hasPermission('enterprise', 'free')).toBe(true)
      expect(hasPermission('enterprise', 'premium')).toBe(true)
      expect(hasPermission('enterprise', 'enterprise')).toBe(true)
    })

    it('should handle unknown tiers gracefully', () => {
      expect(hasPermission('unknown', 'free')).toBe(false)
      expect(hasPermission('unknown', 'premium')).toBe(false)
      expect(hasPermission('unknown', 'enterprise')).toBe(false)
    })
  })

  describe('getUsageLimits', () => {
    it('should return correct limits for free tier', () => {
      const limits = getUsageLimits('free')
      
      expect(limits).toEqual({
        dailyRequests: 100,
        rateLimitPerMinute: 10,
        features: ['cross_domain_recommendations', 'explanations']
      })
    })

    it('should return correct limits for premium tier', () => {
      const limits = getUsageLimits('premium')
      
      expect(limits).toEqual({
        dailyRequests: 1000,
        rateLimitPerMinute: 60,
        features: ['cross_domain_recommendations', 'explanations', 'history', 'priority_support']
      })
    })

    it('should return correct limits for enterprise tier', () => {
      const limits = getUsageLimits('enterprise')
      
      expect(limits).toEqual({
        dailyRequests: 10000,
        rateLimitPerMinute: 300,
        features: ['cross_domain_recommendations', 'explanations', 'history', 'priority_support', 'custom_domains', 'analytics']
      })
    })

    it('should default to free tier limits for unknown tiers', () => {
      const limits = getUsageLimits('unknown')
      
      expect(limits).toEqual({
        dailyRequests: 100,
        rateLimitPerMinute: 10,
        features: ['cross_domain_recommendations', 'explanations']
      })
    })
  })
})