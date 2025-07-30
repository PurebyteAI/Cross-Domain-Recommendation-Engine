import { supabaseAdmin } from '@/lib/supabase'

export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  service: string
  operation?: string
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  statusCode?: number
  responseTime?: number
  metadata?: Record<string, any>
  error?: {
    code?: string
    message: string
    stack?: string
  }
}

export interface SystemMetric {
  name: string
  value: number
  unit?: string
  tags?: Record<string, any>
  timestamp?: Date
}

export class LoggingService {
  private static logBuffer: LogEntry[] = []
  private static metricBuffer: SystemMetric[] = []
  private static flushInterval: NodeJS.Timeout | null = null
  private static readonly BUFFER_SIZE = 100
  private static readonly FLUSH_INTERVAL = 5000 // 5 seconds

  /**
   * Initialize the logging service with periodic flushing
   */
  static initialize(): void {
    if (this.flushInterval) return

    this.flushInterval = setInterval(() => {
      this.flush().catch(error => {
        console.error('[LoggingService] Failed to flush logs:', error)
      })
    }, this.FLUSH_INTERVAL)

    // Flush on process exit
    process.on('beforeExit', () => {
      this.flush().catch(console.error)
    })
  }

  /**
   * Log an info message
   */
  static info(message: string, context: Partial<LogEntry> = {}): void {
    this.addLog({
      level: 'info',
      message,
      service: context.service || 'unknown',
      ...context
    })
  }

  /**
   * Log a warning message
   */
  static warn(message: string, context: Partial<LogEntry> = {}): void {
    this.addLog({
      level: 'warn',
      message,
      service: context.service || 'unknown',
      ...context
    })
  }

  /**
   * Log an error message
   */
  static error(message: string, error?: Error, context: Partial<LogEntry> = {}): void {
    this.addLog({
      level: 'error',
      message,
      service: context.service || 'unknown',
      error: error ? {
        code: (error as any).code,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...context
    })
  }

  /**
   * Record a system metric
   */
  static metric(name: string, value: number, options: Partial<SystemMetric> = {}): void {
    this.metricBuffer.push({
      name,
      value,
      unit: options.unit,
      tags: options.tags,
      timestamp: options.timestamp || new Date()
    })

    // Auto-flush if buffer is full
    if (this.metricBuffer.length >= this.BUFFER_SIZE) {
      this.flush().catch(error => {
        console.error('[LoggingService] Failed to flush metrics:', error)
      })
    }
  }

  /**
   * Record multiple metrics at once
   */
  static metrics(metrics: SystemMetric[]): void {
    metrics.forEach(metric => {
      this.metricBuffer.push({
        ...metric,
        timestamp: metric.timestamp || new Date()
      })
    })

    // Auto-flush if buffer is full
    if (this.metricBuffer.length >= this.BUFFER_SIZE) {
      this.flush().catch(error => {
        console.error('[LoggingService] Failed to flush metrics:', error)
      })
    }
  }

  /**
   * Add log entry to buffer
   */
  private static addLog(entry: LogEntry): void {
    // Validate entry before adding
    if (!entry || !entry.message || !entry.service) {
      console.warn('[LoggingService] Invalid log entry:', entry)
      return
    }

    this.logBuffer.push(entry)

    // Auto-flush if buffer is full or if it's an error
    if (this.logBuffer.length >= this.BUFFER_SIZE || entry.level === 'error') {
      this.flush().catch(error => {
        console.error('[LoggingService] Failed to flush logs:', error)
      })
    }
  }

  /**
   * Flush buffered logs and metrics to Supabase
   */
  static async flush(): Promise<void> {
    const logsToFlush = [...this.logBuffer]
    const metricsToFlush = [...this.metricBuffer]

    this.logBuffer = []
    this.metricBuffer = []

    if (logsToFlush.length === 0 && metricsToFlush.length === 0) {
      return
    }

    // In development, just log to console if database logging fails
    const isDevelopment = process.env.NODE_ENV === 'development'

    // Check if Supabase is properly configured
    const hasSupabaseConfig = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                             process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!hasSupabaseConfig) {
      if (isDevelopment) {
        // In development, fall back to console logging
        logsToFlush.forEach(log => {
          console.log(`[${log.level.toUpperCase()}] [${log.service}] ${log.message}`, log.metadata)
        })
        metricsToFlush.forEach(metric => {
          console.log(`[METRIC] ${metric.name}: ${metric.value}${metric.unit ? metric.unit : ''}`, metric.tags)
        })
      }
      return
    }

    try {
      // Flush logs to error_logs table
      if (logsToFlush.length > 0) {
        const logRecords = logsToFlush
          .filter(log => log && log.message && log.service) // Filter out invalid logs
          .map(log => ({
            level: log.level,
            error_code: log.error?.code || 'LOG_ENTRY',
            error_message: log.message || 'No message',
            status_code: log.statusCode || (log.level === 'error' ? 500 : 200),
            is_operational: log.level !== 'error',
            is_retryable: false,
            request_id: log.requestId || null,
            user_id: log.userId || null,
            endpoint: log.endpoint || null,
            method: log.method || null,
            processing_time: log.responseTime || null,
            error_details: log.error ? {
              code: log.error.code || 'UNKNOWN',
              message: log.error.message || 'Unknown error'
            } : null,
            context_metadata: {
              service: log.service || 'unknown',
              operation: log.operation || null,
              ...(log.metadata || {})
            },
            stack_trace: log.error?.stack || null,
            timestamp: new Date().toISOString()
          }))

        if (logRecords.length > 0) {
          try {
            const { error: logError } = await supabaseAdmin
              .from('error_logs')
              .insert(logRecords)

            if (logError) {
              console.error('[LoggingService] Failed to insert logs:', logError)
              // Log to console as fallback
              logRecords.forEach(record => {
                console.log(`[${record.level.toUpperCase()}] ${record.error_message}`, record.context_metadata)
              })
            }
          } catch (insertError) {
            console.error('[LoggingService] Database insert error:', insertError)
            // Fall back to console logging
            logRecords.forEach(record => {
              console.log(`[${record.level.toUpperCase()}] ${record.error_message}`, record.context_metadata)
            })
          }
        }
      }

      // Flush metrics to system_metrics table
      if (metricsToFlush.length > 0) {
        const metricRecords = metricsToFlush
          .filter(metric => metric && metric.name && typeof metric.value === 'number') // Filter out invalid metrics
          .map(metric => ({
            metric_name: metric.name,
            metric_value: metric.value,
            tags: {
              unit: metric.unit || null,
              ...(metric.tags || {})
            },
            timestamp: (metric.timestamp || new Date()).toISOString()
          }))

        if (metricRecords.length > 0) {
          try {
            const { error: metricError } = await supabaseAdmin
              .from('system_metrics')
              .insert(metricRecords)

            if (metricError) {
              console.error('[LoggingService] Failed to insert metrics:', metricError)
              // Log to console as fallback
              metricRecords.forEach(record => {
                console.log(`[METRIC] ${record.metric_name}: ${record.metric_value}`, record.tags)
              })
            }
          } catch (insertError) {
            console.error('[LoggingService] Database metrics insert error:', insertError)
            // Fall back to console logging
            metricRecords.forEach(record => {
              console.log(`[METRIC] ${record.metric_name}: ${record.metric_value}`, record.tags)
            })
          }
        }
      }

    } catch (error) {
      console.error('[LoggingService] Failed to flush to Supabase:', error)
      
      // In development, fall back to console logging
      if (isDevelopment) {
        logsToFlush.forEach(log => {
          const level = log.level.toUpperCase()
          console.log(`[${level}] ${log.service}: ${log.message}`, log.metadata || {})
        })
        
        metricsToFlush.forEach(metric => {
          console.log(`[METRIC] ${metric.name}: ${metric.value}`, metric.tags || {})
        })
      }
      
      // Don't re-add failed entries to avoid infinite retry loops
      console.error('[LoggingService] Lost logs:', logsToFlush.length, 'metrics:', metricsToFlush.length)
    }
  }

  /**
   * Get recent logs for monitoring dashboard
   */
  static async getRecentLogs(
    limit: number = 100,
    level?: 'info' | 'warn' | 'error',
    service?: string
  ): Promise<LogEntry[]> {
    try {
      let query = supabaseAdmin
        .from('error_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (level) {
        query = query.eq('level', level)
      }

      if (service) {
        query = query.eq('context_metadata->service', service)
      }

      const { data, error } = await query

      if (error) {
        console.error('[LoggingService] Failed to fetch logs:', error)
        return []
      }

      return (data || []).map(record => ({
        level: record.level as 'info' | 'warn' | 'error',
        message: record.error_message,
        service: record.context_metadata?.service || 'unknown',
        operation: record.context_metadata?.operation,
        userId: record.user_id || undefined,
        requestId: record.request_id || undefined,
        endpoint: record.endpoint || undefined,
        method: record.method || undefined,
        statusCode: record.status_code || undefined,
        responseTime: record.processing_time || undefined,
        metadata: record.context_metadata,
        error: record.error_details ? {
          code: record.error_details.code,
          message: record.error_details.message,
          stack: record.stack_trace || undefined
        } : undefined
      }))

    } catch (error) {
      console.error('[LoggingService] Failed to get recent logs:', error)
      return []
    }
  }

  /**
   * Get system metrics for monitoring
   */
  static async getMetrics(
    metricName?: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 1000
  ): Promise<SystemMetric[]> {
    try {
      let query = supabaseAdmin
        .from('system_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (metricName) {
        query = query.eq('metric_name', metricName)
      }

      if (startTime) {
        query = query.gte('timestamp', startTime.toISOString())
      }

      if (endTime) {
        query = query.lte('timestamp', endTime.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('[LoggingService] Failed to fetch metrics:', error)
        return []
      }

      return (data || []).map(record => ({
        name: record.metric_name,
        value: record.metric_value,
        unit: record.tags?.unit,
        tags: record.tags,
        timestamp: new Date(record.timestamp)
      }))

    } catch (error) {
      console.error('[LoggingService] Failed to get metrics:', error)
      return []
    }
  }

  /**
   * Cleanup old logs and metrics
   */
  static async cleanup(daysToKeep: number = 30): Promise<{ logsDeleted: number; metricsDeleted: number }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      // Clean up old logs
      const { data: deletedLogs } = await supabaseAdmin
        .from('error_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id')

      // Clean up old metrics
      const { data: deletedMetrics } = await supabaseAdmin
        .from('system_metrics')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id')

      const result = {
        logsDeleted: deletedLogs?.length || 0,
        metricsDeleted: deletedMetrics?.length || 0
      }

      this.info('Cleanup completed', {
        service: 'logging',
        operation: 'cleanup',
        metadata: result
      })

      return result

    } catch (error) {
      this.error('Cleanup failed', error as Error, {
        service: 'logging',
        operation: 'cleanup'
      })
      return { logsDeleted: 0, metricsDeleted: 0 }
    }
  }

  /**
   * Shutdown the logging service
   */
  static async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

    // Final flush
    await this.flush()
  }
}

// Initialize logging service
LoggingService.initialize()