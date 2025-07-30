import { supabaseAdmin } from '@/lib/supabase'
import { SystemMetricsService } from '@/lib/database'

export interface PerformanceMetric {
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  userId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface SystemHealthMetrics {
  databaseConnections: number
  cacheHitRate: number
  averageResponseTime: number
  errorRate: number
  activeUsers: number
  requestsPerMinute: number
  memoryUsage?: number
  cpuUsage?: number
}

export class PerformanceMonitoringService {
  private static metricsBuffer: PerformanceMetric[] = []
  private static readonly BUFFER_SIZE = 100
  private static readonly FLUSH_INTERVAL = 30000 // 30 seconds

  static {
    // Start periodic flushing of metrics
    if (typeof window === 'undefined') {
      setInterval(() => {
        this.flushMetrics()
      }, this.FLUSH_INTERVAL)
    }
  }

  /**
   * Record a performance metric
   */
  static async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      // Add to buffer
      this.metricsBuffer.push(metric)

      // Flush if buffer is full
      if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
        await this.flushMetrics()
      }

      // Also record in system metrics for real-time monitoring
      await SystemMetricsService.recordResponseTime(metric.endpoint, metric.responseTime)
      
      if (metric.statusCode >= 400) {
        await SystemMetricsService.recordError(metric.endpoint, `${metric.statusCode}`)
      }
    } catch (error) {
      console.error('Error recording performance metric:', error)
    }
  }

  /**
   * Flush buffered metrics to database
   */
  private static async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return

    try {
      const metricsToFlush = [...this.metricsBuffer]
      this.metricsBuffer = []

      // Insert metrics in batch
      const { error } = await supabaseAdmin
        .from('performance_metrics')
        .insert(
          metricsToFlush.map(metric => ({
            endpoint: metric.endpoint,
            method: metric.method,
            response_time_ms: metric.responseTime,
            status_code: metric.statusCode,
            user_id: metric.userId || null,
            timestamp: metric.timestamp.toISOString(),
            metadata: metric.metadata || null
          }))
        )

      if (error) {
        console.error('Error flushing performance metrics:', error)
        // Put metrics back in buffer for retry
        this.metricsBuffer.unshift(...metricsToFlush)
      }
    } catch (error) {
      console.error('Error flushing performance metrics:', error)
    }
  }

  /**
   * Get system health metrics
   */
  static async getSystemHealth(): Promise<SystemHealthMetrics> {
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

      // Get performance metrics from last hour
      const { data: hourlyMetrics, error: metricsError } = await supabaseAdmin
        .from('performance_metrics')
        .select('response_time_ms, status_code, user_id')
        .gte('timestamp', oneHourAgo.toISOString())

      if (metricsError) {
        console.error('Error fetching performance metrics:', metricsError)
      }

      // Get recent metrics for requests per minute
      const { data: recentMetrics, error: recentError } = await supabaseAdmin
        .from('performance_metrics')
        .select('id')
        .gte('timestamp', oneMinuteAgo.toISOString())

      if (recentError) {
        console.error('Error fetching recent metrics:', recentError)
      }

      // Calculate metrics
      const totalRequests = hourlyMetrics?.length || 0
      const errorRequests = hourlyMetrics?.filter(m => m.status_code >= 400).length || 0
      const averageResponseTime = totalRequests > 0 
        ? (hourlyMetrics?.reduce((sum, m) => sum + m.response_time_ms, 0) || 0) / totalRequests
        : 0

      const uniqueUsers = new Set(
        hourlyMetrics?.filter(m => m.user_id).map(m => m.user_id)
      ).size

      // Get database connection count
      let databaseConnections = 0
      try {
        const { data: connCount } = await supabaseAdmin.rpc('get_connection_count')
        databaseConnections = connCount || 0
      } catch (error) {
        console.error('Error getting connection count:', error)
      }

      // Calculate cache hit rate from system metrics
      let cacheHitRate = 0
      try {
        const { data: cacheMetrics } = await supabaseAdmin
          .from('system_metrics')
          .select('metric_value, tags')
          .eq('metric_name', 'cache_hit')
          .gte('timestamp', oneHourAgo.toISOString())

        if (cacheMetrics && cacheMetrics.length > 0) {
          const totalCacheRequests = cacheMetrics.length
          const cacheHits = cacheMetrics.filter(m => m.metric_value === 1).length
          cacheHitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0
        }
      } catch (error) {
        console.error('Error calculating cache hit rate:', error)
      }

      return {
        databaseConnections,
        cacheHitRate,
        averageResponseTime,
        errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
        activeUsers: uniqueUsers,
        requestsPerMinute: recentMetrics?.length || 0,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage()
      }
    } catch (error) {
      console.error('Error getting system health:', error)
      return {
        databaseConnections: 0,
        cacheHitRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeUsers: 0,
        requestsPerMinute: 0
      }
    }
  }

  /**
   * Get memory usage (Node.js only)
   */
  private static getMemoryUsage(): number | undefined {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round((usage.heapUsed / usage.heapTotal) * 100)
    }
    return undefined
  }

  /**
   * Get CPU usage (simplified estimation)
   */
  private static async getCpuUsage(): Promise<number | undefined> {
    if (typeof process !== 'undefined') {
      try {
        const startUsage = process.cpuUsage()
        await new Promise(resolve => setTimeout(resolve, 100))
        const endUsage = process.cpuUsage(startUsage)
        
        const totalUsage = endUsage.user + endUsage.system
        const totalTime = 100 * 1000 // 100ms in microseconds
        
        return Math.round((totalUsage / totalTime) * 100)
      } catch (error) {
        console.error('Error calculating CPU usage:', error)
      }
    }
    return undefined
  }

  /**
   * Get performance trends over time
   */
  static async getPerformanceTrends(hours: number = 24): Promise<{
    responseTimeHistory: Array<{ timestamp: string; averageResponseTime: number }>
    errorRateHistory: Array<{ timestamp: string; errorRate: number }>
    requestVolumeHistory: Array<{ timestamp: string; requestCount: number }>
  }> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      // Get hourly aggregated data
      const { data: metrics, error } = await supabaseAdmin
        .from('performance_metrics')
        .select('timestamp, response_time_ms, status_code')
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true })

      if (error) {
        console.error('Error fetching performance trends:', error)
        return {
          responseTimeHistory: [],
          errorRateHistory: [],
          requestVolumeHistory: []
        }
      }

      // Group by hour
      const hourlyData = new Map<string, {
        responseTimes: number[]
        errorCount: number
        totalCount: number
      }>()

      for (const metric of metrics || []) {
        const hour = new Date(metric.timestamp).toISOString().slice(0, 13) + ':00:00.000Z'
        
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, {
            responseTimes: [],
            errorCount: 0,
            totalCount: 0
          })
        }

        const data = hourlyData.get(hour)!
        data.responseTimes.push(metric.response_time_ms)
        data.totalCount++
        
        if (metric.status_code >= 400) {
          data.errorCount++
        }
      }

      // Convert to arrays
      const responseTimeHistory = Array.from(hourlyData.entries()).map(([timestamp, data]) => ({
        timestamp,
        averageResponseTime: data.responseTimes.length > 0 
          ? data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length
          : 0
      }))

      const errorRateHistory = Array.from(hourlyData.entries()).map(([timestamp, data]) => ({
        timestamp,
        errorRate: data.totalCount > 0 ? data.errorCount / data.totalCount : 0
      }))

      const requestVolumeHistory = Array.from(hourlyData.entries()).map(([timestamp, data]) => ({
        timestamp,
        requestCount: data.totalCount
      }))

      return {
        responseTimeHistory,
        errorRateHistory,
        requestVolumeHistory
      }
    } catch (error) {
      console.error('Error getting performance trends:', error)
      return {
        responseTimeHistory: [],
        errorRateHistory: [],
        requestVolumeHistory: []
      }
    }
  }

  /**
   * Get endpoint performance statistics
   */
  static async getEndpointStats(hours: number = 24): Promise<Array<{
    endpoint: string
    requestCount: number
    averageResponseTime: number
    errorRate: number
    p95ResponseTime: number
  }>> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const { data: metrics, error } = await supabaseAdmin
        .from('performance_metrics')
        .select('endpoint, response_time_ms, status_code')
        .gte('timestamp', startTime.toISOString())

      if (error) {
        console.error('Error fetching endpoint stats:', error)
        return []
      }

      // Group by endpoint
      const endpointData = new Map<string, {
        responseTimes: number[]
        errorCount: number
        totalCount: number
      }>()

      for (const metric of metrics || []) {
        if (!endpointData.has(metric.endpoint)) {
          endpointData.set(metric.endpoint, {
            responseTimes: [],
            errorCount: 0,
            totalCount: 0
          })
        }

        const data = endpointData.get(metric.endpoint)!
        data.responseTimes.push(metric.response_time_ms)
        data.totalCount++
        
        if (metric.status_code >= 400) {
          data.errorCount++
        }
      }

      // Calculate stats for each endpoint
      return Array.from(endpointData.entries()).map(([endpoint, data]) => {
        const sortedTimes = data.responseTimes.sort((a, b) => a - b)
        const p95Index = Math.floor(sortedTimes.length * 0.95)
        
        return {
          endpoint,
          requestCount: data.totalCount,
          averageResponseTime: data.responseTimes.length > 0 
            ? data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length
            : 0,
          errorRate: data.totalCount > 0 ? data.errorCount / data.totalCount : 0,
          p95ResponseTime: sortedTimes[p95Index] || 0
        }
      }).sort((a, b) => b.requestCount - a.requestCount)
    } catch (error) {
      console.error('Error getting endpoint stats:', error)
      return []
    }
  }

  /**
   * Create performance alert if thresholds are exceeded
   */
  static async checkPerformanceAlerts(): Promise<void> {
    try {
      const health = await this.getSystemHealth()
      
      const alerts = []
      
      // Check response time threshold (> 5 seconds)
      if (health.averageResponseTime > 5000) {
        alerts.push({
          type: 'high_response_time',
          severity: 'warning',
          message: `Average response time is ${Math.round(health.averageResponseTime)}ms`,
          value: health.averageResponseTime
        })
      }

      // Check error rate threshold (> 5%)
      if (health.errorRate > 0.05) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'critical',
          message: `Error rate is ${Math.round(health.errorRate * 100)}%`,
          value: health.errorRate
        })
      }

      // Check memory usage threshold (> 90%)
      if (health.memoryUsage && health.memoryUsage > 90) {
        alerts.push({
          type: 'high_memory_usage',
          severity: 'warning',
          message: `Memory usage is ${health.memoryUsage}%`,
          value: health.memoryUsage
        })
      }

      // Record alerts as system metrics
      for (const alert of alerts) {
        await SystemMetricsService.record({
          metric_name: 'performance_alert',
          metric_value: alert.value,
          tags: {
            type: alert.type,
            severity: alert.severity,
            message: alert.message
          }
        })
      }
    } catch (error) {
      console.error('Error checking performance alerts:', error)
    }
  }
}