import { supabaseAdmin } from '@/lib/supabase'
import { LoggingService } from './logging.service'

export interface AlertRule {
  id: string
  name: string
  condition: AlertCondition
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldownMinutes: number
  channels: AlertChannel[]
}

export interface AlertCondition {
  type: 'error_rate' | 'response_time' | 'service_down' | 'usage_spike' | 'custom_metric'
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  threshold: number
  timeWindowMinutes: number
  aggregation?: 'avg' | 'sum' | 'count' | 'max' | 'min'
}

export interface AlertChannel {
  type: 'webhook' | 'email' | 'slack' | 'console'
  config: Record<string, any>
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: string
  message: string
  details: Record<string, any>
  triggeredAt: Date
  resolvedAt?: Date
  status: 'active' | 'resolved' | 'suppressed'
}

export class AlertingService {
  private static readonly DEFAULT_RULES: AlertRule[] = [
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        type: 'error_rate',
        metric: 'error_count',
        operator: 'gt',
        threshold: 10,
        timeWindowMinutes: 5,
        aggregation: 'count'
      },
      severity: 'high',
      enabled: true,
      cooldownMinutes: 15,
      channels: [{ type: 'console', config: {} }]
    },
    {
      id: 'service_down',
      name: 'Critical Service Down',
      condition: {
        type: 'service_down',
        metric: 'service_health',
        operator: 'eq',
        threshold: 0,
        timeWindowMinutes: 1
      },
      severity: 'critical',
      enabled: true,
      cooldownMinutes: 5,
      channels: [{ type: 'console', config: {} }]
    },
    {
      id: 'slow_response_time',
      name: 'Slow Response Time',
      condition: {
        type: 'response_time',
        metric: 'response_time',
        operator: 'gt',
        threshold: 5000,
        timeWindowMinutes: 10,
        aggregation: 'avg'
      },
      severity: 'medium',
      enabled: true,
      cooldownMinutes: 30,
      channels: [{ type: 'console', config: {} }]
    },
    {
      id: 'usage_spike',
      name: 'Unusual Usage Spike',
      condition: {
        type: 'usage_spike',
        metric: 'request_count',
        operator: 'gt',
        threshold: 1000,
        timeWindowMinutes: 5,
        aggregation: 'sum'
      },
      severity: 'medium',
      enabled: true,
      cooldownMinutes: 60,
      channels: [{ type: 'console', config: {} }]
    }
  ]

  private static activeAlerts = new Map<string, Alert>()
  private static alertCooldowns = new Map<string, Date>()

  /**
   * Initialize alerting system
   */
  static initialize(): void {
    LoggingService.info('Initializing alerting system', {
      service: 'alerting',
      operation: 'initialize'
    })

    // Start alert monitoring
    this.startAlertMonitoring()
  }

  /**
   * Start continuous alert monitoring
   */
  private static startAlertMonitoring(): void {
    const checkAlerts = async () => {
      try {
        await this.evaluateAlertRules()
      } catch (error) {
        LoggingService.error('Alert monitoring failed', error as Error, {
          service: 'alerting',
          operation: 'monitoring'
        })
      }
    }

    // Check alerts every minute
    setInterval(checkAlerts, 60000)

    // Initial check
    checkAlerts()
  }

  /**
   * Evaluate all alert rules
   */
  private static async evaluateAlertRules(): Promise<void> {
    const rules = this.DEFAULT_RULES.filter(rule => rule.enabled)

    for (const rule of rules) {
      try {
        // Check cooldown
        const cooldownEnd = this.alertCooldowns.get(rule.id)
        if (cooldownEnd && new Date() < cooldownEnd) {
          continue
        }

        const shouldAlert = await this.evaluateRule(rule)
        
        if (shouldAlert) {
          await this.triggerAlert(rule)
        } else {
          // Check if we should resolve an active alert
          const activeAlert = this.activeAlerts.get(rule.id)
          if (activeAlert && activeAlert.status === 'active') {
            await this.resolveAlert(activeAlert)
          }
        }

      } catch (error) {
        LoggingService.error(`Failed to evaluate alert rule: ${rule.name}`, error as Error, {
          service: 'alerting',
          operation: 'evaluate_rule',
          metadata: { ruleId: rule.id }
        })
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private static async evaluateRule(rule: AlertRule): Promise<boolean> {
    const { condition } = rule
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - condition.timeWindowMinutes * 60 * 1000)

    try {
      const query = supabaseAdmin
        .from('system_metrics')
        .select('metric_value, tags, timestamp')
        .eq('metric_name', condition.metric)
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', endTime.toISOString())

      const { data, error } = await query

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        return false
      }

      // Apply aggregation
      let value: number
      const values = data.map(d => d.metric_value)

      switch (condition.aggregation) {
        case 'avg':
          value = values.reduce((sum, v) => sum + v, 0) / values.length
          break
        case 'sum':
          value = values.reduce((sum, v) => sum + v, 0)
          break
        case 'count':
          value = values.length
          break
        case 'max':
          value = Math.max(...values)
          break
        case 'min':
          value = Math.min(...values)
          break
        default:
          value = values[values.length - 1] // Latest value
      }

      // Evaluate condition
      switch (condition.operator) {
        case 'gt':
          return value > condition.threshold
        case 'gte':
          return value >= condition.threshold
        case 'lt':
          return value < condition.threshold
        case 'lte':
          return value <= condition.threshold
        case 'eq':
          return value === condition.threshold
        default:
          return false
      }

    } catch (error) {
      LoggingService.error(`Failed to evaluate rule condition: ${rule.name}`, error as Error, {
        service: 'alerting',
        operation: 'evaluate_condition',
        metadata: { ruleId: rule.id, condition }
      })
      return false
    }
  }

  /**
   * Trigger an alert
   */
  private static async triggerAlert(rule: AlertRule): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule),
      details: {
        condition: rule.condition,
        triggeredAt: new Date().toISOString()
      },
      triggeredAt: new Date(),
      status: 'active'
    }

    // Store active alert
    this.activeAlerts.set(rule.id, alert)

    // Set cooldown
    const cooldownEnd = new Date(Date.now() + rule.cooldownMinutes * 60 * 1000)
    this.alertCooldowns.set(rule.id, cooldownEnd)

    // Send alert through configured channels
    await this.sendAlert(alert, rule.channels)

    // Log alert
    LoggingService.error(`ALERT: ${alert.message}`, undefined, {
      service: 'alerting',
      operation: 'trigger_alert',
      metadata: {
        alertId: alert.id,
        ruleId: rule.id,
        severity: alert.severity,
        details: alert.details
      }
    })

    // Store alert in database
    await this.storeAlert(alert)
  }

  /**
   * Resolve an active alert
   */
  private static async resolveAlert(alert: Alert): Promise<void> {
    alert.status = 'resolved'
    alert.resolvedAt = new Date()

    // Remove from active alerts
    this.activeAlerts.delete(alert.ruleId)

    // Log resolution
    LoggingService.info(`RESOLVED: ${alert.message}`, {
      service: 'alerting',
      operation: 'resolve_alert',
      metadata: {
        alertId: alert.id,
        ruleId: alert.ruleId,
        duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime()
      }
    })

    // Update alert in database
    await this.updateAlert(alert)
  }

  /**
   * Send alert through configured channels
   */
  private static async sendAlert(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      try {
        switch (channel.type) {
          case 'console':
            console.error(`🚨 [${alert.severity.toUpperCase()}] ${alert.message}`, alert.details)
            break
          
          case 'webhook':
            await this.sendWebhookAlert(alert, channel.config)
            break
          
          case 'email':
            await this.sendEmailAlert(alert, channel.config)
            break
          
          case 'slack':
            await this.sendSlackAlert(alert, channel.config)
            break
          
          default:
            LoggingService.warn(`Unknown alert channel type: ${channel.type}`, {
              service: 'alerting',
              operation: 'send_alert'
            })
        }
      } catch (error) {
        LoggingService.error(`Failed to send alert via ${channel.type}`, error as Error, {
          service: 'alerting',
          operation: 'send_alert',
          metadata: { alertId: alert.id, channelType: channel.type }
        })
      }
    }
  }

  /**
   * Send webhook alert
   */
  private static async sendWebhookAlert(alert: Alert, config: Record<string, any>): Promise<void> {
    if (!config.url) {
      throw new Error('Webhook URL not configured')
    }

    const payload = {
      alert: {
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        details: alert.details,
        triggeredAt: alert.triggeredAt.toISOString()
      },
      system: {
        service: 'cross-domain-recommendation-engine',
        environment: process.env.NODE_ENV || 'development'
      }
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Send email alert (placeholder - would integrate with email service)
   */
  private static async sendEmailAlert(alert: Alert, config: Record<string, any>): Promise<void> {
    // This would integrate with an email service like SendGrid, AWS SES, etc.
    LoggingService.info('Email alert would be sent', {
      service: 'alerting',
      operation: 'send_email',
      metadata: { alertId: alert.id, recipients: config.recipients }
    })
  }

  /**
   * Send Slack alert (placeholder - would integrate with Slack API)
   */
  private static async sendSlackAlert(alert: Alert, config: Record<string, any>): Promise<void> {
    // This would integrate with Slack API
    LoggingService.info('Slack alert would be sent', {
      service: 'alerting',
      operation: 'send_slack',
      metadata: { alertId: alert.id, channel: config.channel }
    })
  }

  /**
   * Generate alert message
   */
  private static generateAlertMessage(rule: AlertRule): string {
    const { condition } = rule
    
    switch (condition.type) {
      case 'error_rate':
        return `High error rate detected: ${condition.threshold} errors in ${condition.timeWindowMinutes} minutes`
      
      case 'service_down':
        return `Critical service is down: ${condition.metric}`
      
      case 'response_time':
        return `Slow response time detected: average ${condition.threshold}ms over ${condition.timeWindowMinutes} minutes`
      
      case 'usage_spike':
        return `Unusual usage spike detected: ${condition.threshold} requests in ${condition.timeWindowMinutes} minutes`
      
      default:
        return `Alert triggered for rule: ${rule.name}`
    }
  }

  /**
   * Store alert in database
   */
  private static async storeAlert(alert: Alert): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('system_metrics')
        .insert({
          metric_name: 'alert_triggered',
          metric_value: 1,
          tags: {
            alert_id: alert.id,
            rule_id: alert.ruleId,
            rule_name: alert.ruleName,
            severity: alert.severity,
            status: alert.status,
            message: alert.message,
            details: alert.details
          },
          timestamp: alert.triggeredAt.toISOString()
        })

      if (error) {
        throw error
      }
    } catch (error) {
      LoggingService.error('Failed to store alert in database', error as Error, {
        service: 'alerting',
        operation: 'store_alert',
        metadata: { alertId: alert.id }
      })
    }
  }

  /**
   * Update alert in database
   */
  private static async updateAlert(alert: Alert): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('system_metrics')
        .insert({
          metric_name: 'alert_resolved',
          metric_value: 1,
          tags: {
            alert_id: alert.id,
            rule_id: alert.ruleId,
            rule_name: alert.ruleName,
            severity: alert.severity,
            status: alert.status,
            resolved_at: alert.resolvedAt?.toISOString(),
            duration_ms: alert.resolvedAt ? 
              alert.resolvedAt.getTime() - alert.triggeredAt.getTime() : null
          },
          timestamp: (alert.resolvedAt || new Date()).toISOString()
        })

      if (error) {
        throw error
      }
    } catch (error) {
      LoggingService.error('Failed to update alert in database', error as Error, {
        service: 'alerting',
        operation: 'update_alert',
        metadata: { alertId: alert.id }
      })
    }
  }

  /**
   * Get active alerts
   */
  static getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  /**
   * Get alert history
   */
  static async getAlertHistory(
    hours: number = 24,
    severity?: string
  ): Promise<Array<{ timestamp: Date; alertId: string; severity: string; message: string; status: string }>> {
    try {
      const startTime = new Date()
      startTime.setHours(startTime.getHours() - hours)

      let query = supabaseAdmin
        .from('system_metrics')
        .select('*')
        .in('metric_name', ['alert_triggered', 'alert_resolved'])
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: false })

      if (severity) {
        query = query.eq('tags->severity', severity)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return (data || []).map(record => ({
        timestamp: new Date(record.timestamp),
        alertId: record.tags?.alert_id || 'unknown',
        severity: record.tags?.severity || 'unknown',
        message: record.tags?.message || 'No message',
        status: record.metric_name === 'alert_triggered' ? 'triggered' : 'resolved'
      }))

    } catch (error) {
      LoggingService.error('Failed to get alert history', error as Error, {
        service: 'alerting',
        operation: 'get_history'
      })
      return []
    }
  }

  /**
   * Manually trigger an alert for testing
   */
  static async triggerTestAlert(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    const testRule: AlertRule = {
      id: 'test_alert',
      name: 'Test Alert',
      condition: {
        type: 'custom_metric',
        metric: 'test',
        operator: 'gt',
        threshold: 0,
        timeWindowMinutes: 1
      },
      severity,
      enabled: true,
      cooldownMinutes: 1,
      channels: [{ type: 'console', config: {} }]
    }

    await this.triggerAlert(testRule)
  }
}

// Initialize alerting service
AlertingService.initialize()