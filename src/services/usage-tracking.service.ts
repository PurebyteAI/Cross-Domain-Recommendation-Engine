import { supabaseAdmin } from '@/lib/supabase'
import { UserProfileService } from './user-profile.service'
import { ApiUsageInsert, SystemMetricInsert } from '@/types/database'

export interface UsageEvent {
  clerkUserId: string
  endpoint: string
  method: string
  statusCode: number
  responseTimeMs: number
  userAgent?: string
  ipAddress?: string
  requestSize?: number
  responseSize?: number
  errorMessage?: string
  metadata?: Record<string, any>
}

export interface UsageAnalytics {
  totalRequests: number
  requestsToday: number
  averageResponseTime: number
  errorRate: number
  topEndpoints: Array<{ endpoint: string; count: number }>
  requestsByHour: Array<{ hour: string; count: number }>
  requestsByTier: Record<string, number>
  responseTimePercentiles: {
    p50: number
    p95: number
    p99: number
  }
}

export class UsageTrackingService {
  /**
   * Track a single API request
   */
  static async trackRequest(event: UsageEvent): Promise<void> {
    try {
      // Get user profile to get internal user ID
      const userProfile = await UserProfileService.getProfileByClerkId(event.clerkUserId)
      if (!userProfile) {
        console.warn(`User profile not found for Clerk ID: ${event.clerkUserId}`)
        return
      }

      const today = new Date().toISOString().split('T')[0]

      // Record API usage in database
      const usageRecord: ApiUsageInsert = {
        user_id: userProfile.id,
        endpoint: event.endpoint,
        request_count: 1,
        response_time_ms: event.responseTimeMs,
        status_code: event.statusCode,
        date: today,
      }

      await supabaseAdmin
        .from('api_usage')
        .insert(usageRecord)

      // Record system metrics for analytics
      await Promise.all([
        this.recordMetric('request_count', 1, {
          endpoint: event.endpoint,
          method: event.method,
          status_code: event.statusCode,
          user_tier: userProfile.tier,
        }),
        this.recordMetric('response_time', event.responseTimeMs, {
          endpoint: event.endpoint,
          method: event.method,
        }),
        // Record error if status code indicates failure
        ...(event.statusCode >= 400 ? [
          this.recordMetric('error_count', 1, {
            endpoint: event.endpoint,
            status_code: event.statusCode,
            error_message: event.errorMessage,
          })
        ] : []),
      ])

    } catch (error) {
      console.error('Failed to track request:', error)
      // Don't throw - tracking failures shouldn't affect the main request
    }
  }

  /**
   * Track multiple requests in batch (for performance)
   */
  static async trackRequestsBatch(events: UsageEvent[]): Promise<void> {
    if (events.length === 0) return

    try {
      // Group events by user to minimize profile lookups
      const userProfiles = new Map<string, string>() // clerkUserId -> internal userId

      for (const event of events) {
        if (!userProfiles.has(event.clerkUserId)) {
          const profile = await UserProfileService.getProfileByClerkId(event.clerkUserId)
          if (profile) {
            userProfiles.set(event.clerkUserId, profile.id)
          }
        }
      }

      const today = new Date().toISOString().split('T')[0]

      // Prepare batch inserts
      const usageRecords: ApiUsageInsert[] = []
      const metricRecords: SystemMetricInsert[] = []

      for (const event of events) {
        const userId = userProfiles.get(event.clerkUserId)
        if (!userId) continue

        // API usage record
        usageRecords.push({
          user_id: userId,
          endpoint: event.endpoint,
          request_count: 1,
          response_time_ms: event.responseTimeMs,
          status_code: event.statusCode,
          date: today,
        })

        // System metrics
        metricRecords.push(
          {
            metric_name: 'request_count',
            metric_value: 1,
            tags: {
              endpoint: event.endpoint,
              method: event.method,
              status_code: event.statusCode,
            },
          },
          {
            metric_name: 'response_time',
            metric_value: event.responseTimeMs,
            tags: {
              endpoint: event.endpoint,
              method: event.method,
            },
          }
        )

        // Add error metric if needed
        if (event.statusCode >= 400) {
          metricRecords.push({
            metric_name: 'error_count',
            metric_value: 1,
            tags: {
              endpoint: event.endpoint,
              status_code: event.statusCode,
              error_message: event.errorMessage,
            },
          })
        }
      }

      // Execute batch inserts
      await Promise.all([
        supabaseAdmin.from('api_usage').insert(usageRecords),
        supabaseAdmin.from('system_metrics').insert(metricRecords),
      ])

    } catch (error) {
      console.error('Failed to track requests batch:', error)
    }
  }

  /**
   * Get usage analytics for a specific user
   */
  static async getUserAnalytics(
    clerkUserId: string,
    startDate?: string,
    endDate?: string
  ): Promise<UsageAnalytics> {
    try {
      const userProfile = await UserProfileService.getProfileByClerkId(clerkUserId)
      if (!userProfile) {
        return this.getEmptyAnalytics()
      }

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days ago
      const end = endDate || new Date().toISOString().split('T')[0] // today
      const today = new Date().toISOString().split('T')[0]

      // Get usage data from database
      const { data: usageData } = await supabaseAdmin
        .from('api_usage')
        .select('*')
        .eq('user_id', userProfile.id)
        .gte('date', start)
        .lte('date', end)

      if (!usageData || usageData.length === 0) {
        return this.getEmptyAnalytics()
      }

      // Calculate analytics
      const totalRequests = usageData.reduce((sum, record) => sum + record.request_count, 0)
      const requestsToday = usageData
        .filter(record => record.date === today)
        .reduce((sum, record) => sum + record.request_count, 0)

      const responseTimes = usageData
        .filter(record => record.response_time_ms !== null)
        .map(record => record.response_time_ms!)

      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0

      const errorCount = usageData
        .filter(record => record.status_code && record.status_code >= 400)
        .reduce((sum, record) => sum + record.request_count, 0)

      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

      // Top endpoints
      const endpointCounts = new Map<string, number>()
      usageData.forEach(record => {
        const current = endpointCounts.get(record.endpoint) || 0
        endpointCounts.set(record.endpoint, current + record.request_count)
      })

      const topEndpoints = Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Requests by hour (last 24 hours)
      const requestsByHour = await this.getRequestsByHour(userProfile.id)

      // Response time percentiles
      const responseTimePercentiles = this.calculatePercentiles(responseTimes)

      return {
        totalRequests,
        requestsToday,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        topEndpoints,
        requestsByHour,
        requestsByTier: { [userProfile.tier]: totalRequests },
        responseTimePercentiles,
      }

    } catch (error) {
      console.error('Failed to get user analytics:', error)
      return this.getEmptyAnalytics()
    }
  }

  /**
   * Get system-wide analytics (admin function)
   */
  static async getSystemAnalytics(
    startDate?: string,
    endDate?: string
  ): Promise<UsageAnalytics & { userCount: number; tierDistribution: Record<string, number> }> {
    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days ago
      const end = endDate || new Date().toISOString().split('T')[0] // today
      const today = new Date().toISOString().split('T')[0]

      // Get system-wide usage data
      const { data: usageData } = await supabaseAdmin
        .from('api_usage')
        .select(`
          *,
          user_profiles!inner(tier)
        `)
        .gte('date', start)
        .lte('date', end)

      if (!usageData || usageData.length === 0) {
        return { ...this.getEmptyAnalytics(), userCount: 0, tierDistribution: {} }
      }

      // Calculate system analytics
      const totalRequests = usageData.reduce((sum, record) => sum + record.request_count, 0)
      const requestsToday = usageData
        .filter(record => record.date === today)
        .reduce((sum, record) => sum + record.request_count, 0)

      const responseTimes = usageData
        .filter(record => record.response_time_ms !== null)
        .map(record => record.response_time_ms!)

      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0

      const errorCount = usageData
        .filter(record => record.status_code && record.status_code >= 400)
        .reduce((sum, record) => sum + record.request_count, 0)

      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

      // Top endpoints
      const endpointCounts = new Map<string, number>()
      usageData.forEach(record => {
        const current = endpointCounts.get(record.endpoint) || 0
        endpointCounts.set(record.endpoint, current + record.request_count)
      })

      const topEndpoints = Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Requests by tier
      const requestsByTier: Record<string, number> = {}
      usageData.forEach(record => {
        const tier = (record as any).user_profiles.tier
        requestsByTier[tier] = (requestsByTier[tier] || 0) + record.request_count
      })

      // User count and tier distribution
      const { data: userStats } = await supabaseAdmin
        .from('user_profiles')
        .select('tier')

      const userCount = userStats?.length || 0
      const tierDistribution: Record<string, number> = {}
      userStats?.forEach(user => {
        tierDistribution[user.tier] = (tierDistribution[user.tier] || 0) + 1
      })

      // Requests by hour (system-wide)
      const requestsByHour = await this.getSystemRequestsByHour()

      // Response time percentiles
      const responseTimePercentiles = this.calculatePercentiles(responseTimes)

      return {
        totalRequests,
        requestsToday,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        topEndpoints,
        requestsByHour,
        requestsByTier,
        responseTimePercentiles,
        userCount,
        tierDistribution,
      }

    } catch (error) {
      console.error('Failed to get system analytics:', error)
      return { ...this.getEmptyAnalytics(), userCount: 0, tierDistribution: {} }
    }
  }

  /**
   * Clean up old usage data (for data retention)
   */
  static async cleanupOldData(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const cutoffDateString = cutoffDate.toISOString().split('T')[0]

      // Clean up API usage data
      const { data: deletedUsage } = await supabaseAdmin
        .from('api_usage')
        .delete()
        .lt('date', cutoffDateString)
        .select('id')

      // Clean up old system metrics
      const { data: deletedMetrics } = await supabaseAdmin
        .from('system_metrics')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id')

      const totalDeleted = (deletedUsage?.length || 0) + (deletedMetrics?.length || 0)

      console.log(`Cleaned up ${totalDeleted} old usage records`)
      return totalDeleted

    } catch (error) {
      console.error('Failed to cleanup old data:', error)
      return 0
    }
  }

  // Private helper methods

  private static async recordMetric(
    metricName: string,
    value: number,
    tags?: Record<string, any>
  ): Promise<void> {
    const metric: SystemMetricInsert = {
      metric_name: metricName,
      metric_value: value,
      tags,
    }

    await supabaseAdmin
      .from('system_metrics')
      .insert(metric)
  }

  private static async getRequestsByHour(userId: string): Promise<Array<{ hour: string; count: number }>> {
    try {
      // Get requests for the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const { data } = await supabaseAdmin
        .from('api_usage')
        .select('created_at, request_count')
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo.toISOString())

      if (!data) return []

      // Group by hour
      const hourCounts = new Map<string, number>()
      data.forEach(record => {
        const hour = new Date(record.created_at).toISOString().substring(0, 13) // YYYY-MM-DDTHH
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + record.request_count)
      })

      return Array.from(hourCounts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour))

    } catch (error) {
      console.error('Failed to get requests by hour:', error)
      return []
    }
  }

  private static async getSystemRequestsByHour(): Promise<Array<{ hour: string; count: number }>> {
    try {
      // Get system-wide requests for the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const { data } = await supabaseAdmin
        .from('api_usage')
        .select('created_at, request_count')
        .gte('created_at', twentyFourHoursAgo.toISOString())

      if (!data) return []

      // Group by hour
      const hourCounts = new Map<string, number>()
      data.forEach(record => {
        const hour = new Date(record.created_at).toISOString().substring(0, 13) // YYYY-MM-DDTHH
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + record.request_count)
      })

      return Array.from(hourCounts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour))

    } catch (error) {
      console.error('Failed to get system requests by hour:', error)
      return []
    }
  }

  private static calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1
      return sorted[Math.max(0, index)]
    }

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    }
  }

  private static getEmptyAnalytics(): UsageAnalytics {
    return {
      totalRequests: 0,
      requestsToday: 0,
      averageResponseTime: 0,
      errorRate: 0,
      topEndpoints: [],
      requestsByHour: [],
      requestsByTier: {},
      responseTimePercentiles: { p50: 0, p95: 0, p99: 0 },
    }
  }
}