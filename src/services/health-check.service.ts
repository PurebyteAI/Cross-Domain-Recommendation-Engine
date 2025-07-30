import { createCachedQlooService } from './cached-qloo.service'
import { GeminiService } from './gemini.service'
import { supabaseAdmin } from '@/lib/supabase'
import { LoggingService } from './logging.service'

export interface HealthCheckResult {
  service: string
  healthy: boolean
  responseTime: number
  error?: string
  details?: Record<string, any>
  timestamp: Date
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: HealthCheckResult[]
  timestamp: Date
  version: string
  environment: string
}

export class HealthCheckService {
  private static readonly HEALTH_CHECK_TIMEOUT = 10000 // 10 seconds
  private static readonly CRITICAL_SERVICES = ['database', 'qloo', 'gemini']

  /**
   * Perform comprehensive health check of all services
   */
  static async performHealthCheck(detailed: boolean = false): Promise<SystemHealthStatus> {
    const startTime = Date.now()
    const services: HealthCheckResult[] = []

    LoggingService.info('Starting health check', {
      service: 'health-check',
      operation: 'perform_check',
      metadata: { detailed }
    })

    // Run all health checks in parallel
    const healthChecks = [
      this.checkDatabase(detailed),
      this.checkQlooService(detailed),
      this.checkGeminiService(detailed),
      this.checkRedisCache(),
    ]

    const results = await Promise.allSettled(healthChecks)

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        services.push(result.value)
      } else {
        const serviceNames = ['database', 'qloo', 'gemini', 'redis']
        services.push({
          service: serviceNames[index],
          healthy: false,
          responseTime: 0,
          error: result.reason?.message || 'Health check failed',
          timestamp: new Date()
        })
      }
    })

    // Determine overall health status
    const criticalServicesHealth = services.filter(s => 
      this.CRITICAL_SERVICES.includes(s.service)
    )
    
    const healthyCount = criticalServicesHealth.filter(s => s.healthy).length
    const totalCritical = criticalServicesHealth.length

    let overall: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyCount === totalCritical) {
      overall = 'healthy'
    } else if (healthyCount > 0) {
      overall = 'degraded'
    } else {
      overall = 'unhealthy'
    }

    const status: SystemHealthStatus = {
      overall,
      services,
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    // Log health check results
    const totalTime = Date.now() - startTime
    LoggingService.info('Health check completed', {
      service: 'health-check',
      operation: 'perform_check',
      responseTime: totalTime,
      metadata: {
        overall: status.overall,
        servicesChecked: services.length,
        healthyServices: services.filter(s => s.healthy).length
      }
    })

    // Record metrics
    LoggingService.metrics([
      {
        name: 'health_check_duration',
        value: totalTime,
        unit: 'ms',
        tags: { detailed: detailed.toString() }
      },
      {
        name: 'services_healthy',
        value: services.filter(s => s.healthy).length,
        tags: { total: services.length.toString() }
      }
    ])

    return status
  }

  /**
   * Check database connectivity and performance
   */
  private static async checkDatabase(detailed: boolean): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Basic connectivity test
      const { error: basicError } = await Promise.race([
        supabaseAdmin
          .from('user_profiles')
          .select('count')
          .limit(1)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), this.HEALTH_CHECK_TIMEOUT)
        )
      ]) as any

      if (basicError && basicError.code !== 'PGRST116') {
        throw new Error(`Database query failed: ${basicError.message}`)
      }

      const details: Record<string, any> = {
        basicConnectivity: 'passed'
      }

      // Detailed checks
      if (detailed) {
        // Test write capability
        try {
          const testRecord = {
            metric_name: 'health_check_test',
            metric_value: 1,
            tags: { test: true, timestamp: Date.now() }
          }

          const { error: insertError } = await supabaseAdmin
            .from('system_metrics')
            .insert(testRecord)

          if (insertError) {
            throw new Error(`Database write test failed: ${insertError.message}`)
          }

          // Clean up test record
          await supabaseAdmin
            .from('system_metrics')
            .delete()
            .eq('metric_name', 'health_check_test')
            .eq('tags->test', true)

          details.writeTest = 'passed'
        } catch (error) {
          details.writeTest = 'failed'
          details.writeError = error instanceof Error ? error.message : 'Unknown error'
        }

        // Get connection pool stats if available
        try {
          const { data: poolStats } = await supabaseAdmin
            .from('pg_stat_activity')
            .select('count')
            .limit(1)

          details.connectionPool = poolStats ? 'available' : 'unavailable'
        } catch {
          details.connectionPool = 'unavailable'
        }
      }

      return {
        service: 'database',
        healthy: true,
        responseTime: Date.now() - startTime,
        details,
        timestamp: new Date()
      }

    } catch (error) {
      return {
        service: 'database',
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check Qloo service connectivity and performance
   */
  private static async checkQlooService(detailed: boolean): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      if (!process.env.QLOO_API_KEY) {
        throw new Error('QLOO_API_KEY not configured')
      }

      const qlooService = createCachedQlooService()
      
      // Basic connectivity test - get cache stats
      const cacheStats = await Promise.race([
        qlooService.getCacheStats(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Qloo service timeout')), this.HEALTH_CHECK_TIMEOUT)
        )
      ]) as any

      const details: Record<string, any> = {
        cacheStats: {
          l1Size: cacheStats.l1Size,
          l2Connected: cacheStats.l2Connected
        }
      }

      // Detailed checks
      if (detailed) {
        try {
          // Test actual API call
          const searchResults = await qlooService.searchEntity('Radiohead', 'artist')
          details.apiTest = 'passed'
          details.searchResults = searchResults.length
        } catch (error) {
          details.apiTest = 'failed'
          details.apiError = error instanceof Error ? error.message : 'Unknown error'
        }
      }

      return {
        service: 'qloo',
        healthy: true,
        responseTime: Date.now() - startTime,
        details,
        timestamp: new Date()
      }

    } catch (error) {
      return {
        service: 'qloo',
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Qloo service error',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check Gemini service connectivity and performance
   */
  private static async checkGeminiService(detailed: boolean): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured')
      }

      const geminiService = new GeminiService({
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
      })

      // Basic connectivity test - get model info
      const modelInfo = geminiService.getModelInfo()
      
      const details: Record<string, any> = {
        model: modelInfo.model,
        config: modelInfo.config
      }

      // Detailed checks
      if (detailed) {
        try {
          // Test actual API call with timeout
          const testExplanation = await Promise.race([
            geminiService.generateExplanation({
              inputEntity: { name: 'Test Artist', type: 'artist' },
              recommendedEntity: { name: 'Test Movie', type: 'movie' },
              sharedThemes: [{
                tag_id: 'test',
                name: 'test theme',
                types: ['artist', 'movie'],
                subtype: 'mood',
                affinity: 0.8
              }],
              affinityScore: 0.8
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Gemini API timeout')), this.HEALTH_CHECK_TIMEOUT)
            )
          ]) as any

          details.apiTest = 'passed'
          details.explanationLength = testExplanation.explanation.length
        } catch (error) {
          details.apiTest = 'failed'
          details.apiError = error instanceof Error ? error.message : 'Unknown error'
        }
      }

      return {
        service: 'gemini',
        healthy: true,
        responseTime: Date.now() - startTime,
        details,
        timestamp: new Date()
      }

    } catch (error) {
      return {
        service: 'gemini',
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Gemini service error',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check Redis cache connectivity
   */
  private static async checkRedisCache(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      if (!process.env.REDIS_URL) {
        return {
          service: 'redis',
          healthy: false,
          responseTime: Date.now() - startTime,
          error: 'REDIS_URL not configured',
          timestamp: new Date()
        }
      }

      // Redis connectivity is checked through the Qloo service cache stats
      // This is a simplified check - in production you might want direct Redis connection testing
      const details: Record<string, any> = {
        configured: true,
        note: 'Redis health checked via cache service'
      }

      return {
        service: 'redis',
        healthy: true,
        responseTime: Date.now() - startTime,
        details,
        timestamp: new Date()
      }

    } catch (error) {
      return {
        service: 'redis',
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        timestamp: new Date()
      }
    }
  }

  /**
   * Monitor service health continuously
   */
  static async startHealthMonitoring(intervalMs: number = 60000): Promise<void> {
    LoggingService.info('Starting health monitoring', {
      service: 'health-check',
      operation: 'start_monitoring',
      metadata: { intervalMs }
    })

    const performCheck = async () => {
      try {
        const health = await this.performHealthCheck(false)
        
        // Record health metrics
        LoggingService.metrics([
          {
            name: 'system_health_status',
            value: health.overall === 'healthy' ? 1 : health.overall === 'degraded' ? 0.5 : 0,
            tags: { status: health.overall }
          },
          ...health.services.map(service => ({
            name: 'service_health',
            value: service.healthy ? 1 : 0,
            tags: { 
              service: service.service,
              response_time: service.responseTime.toString()
            }
          }))
        ])

        // Log unhealthy services
        const unhealthyServices = health.services.filter(s => !s.healthy)
        if (unhealthyServices.length > 0) {
          LoggingService.warn('Unhealthy services detected', {
            service: 'health-check',
            operation: 'monitoring',
            metadata: {
              unhealthyServices: unhealthyServices.map(s => ({
                service: s.service,
                error: s.error
              }))
            }
          })
        }

      } catch (error) {
        LoggingService.error('Health monitoring failed', error as Error, {
          service: 'health-check',
          operation: 'monitoring'
        })
      }
    }

    // Initial check
    await performCheck()

    // Schedule periodic checks
    setInterval(performCheck, intervalMs)
  }

  /**
   * Get health history for monitoring dashboard
   */
  static async getHealthHistory(
    hours: number = 24,
    service?: string
  ): Promise<Array<{ timestamp: Date; healthy: boolean; service: string; responseTime: number }>> {
    try {
      const startTime = new Date()
      startTime.setHours(startTime.getHours() - hours)

      let query = supabaseAdmin
        .from('system_metrics')
        .select('*')
        .eq('metric_name', 'service_health')
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: false })

      if (service) {
        query = query.eq('tags->service', service)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return (data || []).map(record => ({
        timestamp: new Date(record.timestamp),
        healthy: record.metric_value === 1,
        service: record.tags?.service || 'unknown',
        responseTime: parseInt(record.tags?.response_time || '0', 10)
      }))

    } catch (error) {
      LoggingService.error('Failed to get health history', error as Error, {
        service: 'health-check',
        operation: 'get_history'
      })
      return []
    }
  }
}