import { cacheService, CACHE_NAMESPACES } from '@/lib/simple-cache'
import { UserProfileService } from './user-profile.service'
import { ApiUsageService } from '@/lib/database'
import { UserProfile } from '@/types/database'

// Rate limiting configuration by tier
export const RATE_LIMITS = {
  free: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
    burstLimit: 15, // Allow short bursts
  },
  premium: {
    requestsPerMinute: 50,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 75,
  },
  enterprise: {
    requestsPerMinute: 200,
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    burstLimit: 300,
  },
} as const

export type UserTier = keyof typeof RATE_LIMITS

// Rate limit result interface
export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
  tier: UserTier
}

// Rate limit window types
type TimeWindow = 'minute' | 'hour' | 'day'

export class RateLimiterService {
  private static readonly CACHE_PREFIX = 'rate_limit'

  /**
   * Check if a user request should be rate limited
   */
  static async checkRateLimit(
    clerkUserId: string,
    endpoint: string = 'default'
  ): Promise<RateLimitResult> {
    try {
      // Get user profile to determine tier
      const userProfile = await UserProfileService.getProfileByClerkId(clerkUserId)
      const tier = (userProfile?.tier as UserTier) || 'free'
      const limits = RATE_LIMITS[tier]

      if (!userProfile) {
        // In development, be more lenient for unknown users
        const isDevelopment = process.env.NODE_ENV === 'development'
        if (isDevelopment) {
          return this.createRateLimitResult(true, 'free', limits.requestsPerMinute, limits.requestsPerMinute - 1, Date.now() + 60000)
        }
        // Default to free tier for unknown users in production
        return this.createRateLimitResult(false, 'free', limits.requestsPerMinute, 0, Date.now() + 60000)
      }

      // Check all time windows (minute, hour, day)
      const checks = await Promise.all([
        this.checkTimeWindow(clerkUserId, endpoint, 'minute', limits.requestsPerMinute),
        this.checkTimeWindow(clerkUserId, endpoint, 'hour', limits.requestsPerHour),
        this.checkTimeWindow(clerkUserId, endpoint, 'day', limits.requestsPerDay),
      ])

      // Find the most restrictive limit
      const mostRestrictive = checks.reduce((prev, current) => 
        current.remaining < prev.remaining ? current : prev
      )

      // Check burst limit (short-term spike protection)
      const burstCheck = await this.checkBurstLimit(clerkUserId, endpoint, limits.burstLimit)
      
      if (!burstCheck.allowed) {
        return {
          ...burstCheck,
          tier,
        }
      }

      return {
        allowed: mostRestrictive.allowed,
        limit: mostRestrictive.limit,
        remaining: mostRestrictive.remaining,
        resetTime: mostRestrictive.resetTime,
        retryAfter: mostRestrictive.allowed ? undefined : this.calculateRetryAfter(mostRestrictive.resetTime),
        tier,
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Fail open - allow request if rate limiting fails
      return this.createRateLimitResult(true, 'free', 1, 1, Date.now() + 60000)
    }
  }

  /**
   * Record a successful request (increment counters)
   */
  static async recordRequest(
    clerkUserId: string,
    endpoint: string = 'default'
  ): Promise<void> {
    try {
      const promises = [
        this.incrementCounter(clerkUserId, endpoint, 'minute'),
        this.incrementCounter(clerkUserId, endpoint, 'hour'),
        this.incrementCounter(clerkUserId, endpoint, 'day'),
        this.incrementBurstCounter(clerkUserId, endpoint),
      ]

      await Promise.all(promises)
    } catch (error) {
      console.error('Failed to record request:', error)
      // Don't throw - this shouldn't block the request
    }
  }

  /**
   * Get current usage statistics for a user
   */
  static async getUserUsageStats(clerkUserId: string): Promise<{
    minute: { used: number; limit: number; resetTime: number }
    hour: { used: number; limit: number; resetTime: number }
    day: { used: number; limit: number; resetTime: number }
    tier: UserTier
  }> {
    try {
      const userProfile = await UserProfileService.getProfileByClerkId(clerkUserId)
      const tier = (userProfile?.tier as UserTier) || 'free'
      const limits = RATE_LIMITS[tier]

      const [minuteUsage, hourUsage, dayUsage] = await Promise.all([
        this.getCurrentUsage(clerkUserId, 'default', 'minute'),
        this.getCurrentUsage(clerkUserId, 'default', 'hour'),
        this.getCurrentUsage(clerkUserId, 'default', 'day'),
      ])

      return {
        minute: {
          used: minuteUsage.count,
          limit: limits.requestsPerMinute,
          resetTime: minuteUsage.resetTime,
        },
        hour: {
          used: hourUsage.count,
          limit: limits.requestsPerHour,
          resetTime: hourUsage.resetTime,
        },
        day: {
          used: dayUsage.count,
          limit: limits.requestsPerDay,
          resetTime: dayUsage.resetTime,
        },
        tier,
      }
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      return {
        minute: { used: 0, limit: 0, resetTime: 0 },
        hour: { used: 0, limit: 0, resetTime: 0 },
        day: { used: 0, limit: 0, resetTime: 0 },
        tier: 'free',
      }
    }
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  static async resetUserLimits(clerkUserId: string): Promise<void> {
    try {
      const patterns = [
        `${this.CACHE_PREFIX}:${clerkUserId}:*`,
      ]

      for (const pattern of patterns) {
        await cacheService.clearNamespace(pattern)
      }
    } catch (error) {
      console.error('Failed to reset user limits:', error)
      throw error
    }
  }

  // Private helper methods

  private static async checkTimeWindow(
    clerkUserId: string,
    endpoint: string,
    window: TimeWindow,
    limit: number
  ): Promise<RateLimitResult> {
    const usage = await this.getCurrentUsage(clerkUserId, endpoint, window)
    const allowed = usage.count < limit
    const remaining = Math.max(0, limit - usage.count)

    return this.createRateLimitResult(allowed, 'free', limit, remaining, usage.resetTime)
  }

  private static async checkBurstLimit(
    clerkUserId: string,
    endpoint: string,
    burstLimit: number
  ): Promise<RateLimitResult> {
    const key = `${this.CACHE_PREFIX}:burst:${clerkUserId}:${endpoint}`
    const now = Date.now()
    const windowStart = now - 10000 // 10-second burst window

    try {
      // Get recent request timestamps
      const recentRequests = await cacheService.get<number[]>(CACHE_NAMESPACES.SYSTEM_METRICS, key) || []
      
      // Filter to only recent requests
      const validRequests = recentRequests.filter(timestamp => timestamp > windowStart)
      
      const allowed = validRequests.length < burstLimit
      const remaining = Math.max(0, burstLimit - validRequests.length)
      const resetTime = windowStart + 10000

      return this.createRateLimitResult(allowed, 'free', burstLimit, remaining, resetTime)
    } catch (error) {
      console.error('Burst limit check failed:', error)
      return this.createRateLimitResult(true, 'free', burstLimit, burstLimit, now + 10000)
    }
  }

  private static async getCurrentUsage(
    clerkUserId: string,
    endpoint: string,
    window: TimeWindow
  ): Promise<{ count: number; resetTime: number }> {
    const key = this.generateCacheKey(clerkUserId, endpoint, window)
    const windowInfo = this.getWindowInfo(window)
    
    try {
      const count = await cacheService.get<number>(CACHE_NAMESPACES.SYSTEM_METRICS, key) || 0
      return {
        count,
        resetTime: windowInfo.resetTime,
      }
    } catch (error) {
      console.error('Failed to get current usage:', error)
      return { count: 0, resetTime: windowInfo.resetTime }
    }
  }

  private static async incrementCounter(
    clerkUserId: string,
    endpoint: string,
    window: TimeWindow
  ): Promise<void> {
    const key = this.generateCacheKey(clerkUserId, endpoint, window)
    const windowInfo = this.getWindowInfo(window)
    
    try {
      const currentCount = await cacheService.get<number>(CACHE_NAMESPACES.SYSTEM_METRICS, key) || 0
      const newCount = currentCount + 1
      
      // Set with TTL until window reset
      const ttlSeconds = Math.ceil((windowInfo.resetTime - Date.now()) / 1000)
      await cacheService.set(CACHE_NAMESPACES.SYSTEM_METRICS, key, newCount, ttlSeconds)
    } catch (error) {
      console.error('Failed to increment counter:', error)
    }
  }

  private static async incrementBurstCounter(
    clerkUserId: string,
    endpoint: string
  ): Promise<void> {
    const key = `${this.CACHE_PREFIX}:burst:${clerkUserId}:${endpoint}`
    const now = Date.now()
    
    try {
      const recentRequests = await cacheService.get<number[]>(CACHE_NAMESPACES.SYSTEM_METRICS, key) || []
      const windowStart = now - 10000 // 10-second window
      
      // Add current request and filter old ones
      const updatedRequests = [...recentRequests, now].filter(timestamp => timestamp > windowStart)
      
      // Store with 10-second TTL
      await cacheService.set(CACHE_NAMESPACES.SYSTEM_METRICS, key, updatedRequests, 10)
    } catch (error) {
      console.error('Failed to increment burst counter:', error)
    }
  }

  private static generateCacheKey(
    clerkUserId: string,
    endpoint: string,
    window: TimeWindow
  ): string {
    const windowInfo = this.getWindowInfo(window)
    return `${this.CACHE_PREFIX}:${clerkUserId}:${endpoint}:${window}:${windowInfo.bucket}`
  }

  private static getWindowInfo(window: TimeWindow): { bucket: string; resetTime: number } {
    const now = new Date()
    
    switch (window) {
      case 'minute':
        const minuteBucket = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`
        const nextMinute = new Date(now)
        nextMinute.setMinutes(now.getMinutes() + 1, 0, 0)
        return { bucket: minuteBucket, resetTime: nextMinute.getTime() }
        
      case 'hour':
        const hourBucket = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`
        const nextHour = new Date(now)
        nextHour.setHours(now.getHours() + 1, 0, 0, 0)
        return { bucket: hourBucket, resetTime: nextHour.getTime() }
        
      case 'day':
        const dayBucket = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
        const nextDay = new Date(now)
        nextDay.setDate(now.getDate() + 1)
        nextDay.setHours(0, 0, 0, 0)
        return { bucket: dayBucket, resetTime: nextDay.getTime() }
        
      default:
        throw new Error(`Invalid time window: ${window}`)
    }
  }

  private static createRateLimitResult(
    allowed: boolean,
    tier: UserTier,
    limit: number,
    remaining: number,
    resetTime: number
  ): RateLimitResult {
    return {
      allowed,
      limit,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : this.calculateRetryAfter(resetTime),
      tier,
    }
  }

  private static calculateRetryAfter(resetTime: number): number {
    return Math.ceil((resetTime - Date.now()) / 1000)
  }
}