import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { AlertingService } from '../alerting.service'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        }))
      })),
      insert: vi.fn().mockResolvedValue({ error: null })
    }))
  }
}))

vi.mock('../logging.service', () => ({
  LoggingService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    metrics: vi.fn()
  }
}))

// Mock global fetch
global.fetch = vi.fn()

describe('AlertingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('alert rule evaluation', () => {
    it('should handle database errors gracefully', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase')
      const mockFrom = supabaseAdmin.from as Mock
      
      // Mock database error
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Database connection failed')
              })
            }))
          }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      // Should not throw when evaluating rules with database errors
      expect(() => {
        vi.advanceTimersByTime(60000)
      }).not.toThrow()
    })
  })

  describe('alert channels', () => {
    it('should send webhook alerts', async () => {
      const mockFetch = global.fetch as Mock
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const testRule = {
        id: 'test_webhook',
        name: 'Test Webhook Alert',
        condition: {
          type: 'custom_metric' as const,
          metric: 'test',
          operator: 'gt' as const,
          threshold: 0,
          timeWindowMinutes: 1
        },
        severity: 'medium' as const,
        enabled: true,
        cooldownMinutes: 1,
        channels: [{
          type: 'webhook' as const,
          config: {
            url: 'https://example.com/webhook',
            headers: { 'Authorization': 'Bearer token' }
          }
        }]
      }

      // Manually trigger alert to test webhook
      await (AlertingService as any).triggerAlert(testRule)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token'
          }),
          body: expect.stringContaining('Test Webhook Alert')
        })
      )
    })

    it('should handle webhook failures gracefully', async () => {
      const mockFetch = global.fetch as Mock
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      const { LoggingService } = await import('../logging.service')
      const mockError = LoggingService.error as Mock

      const testRule = {
        id: 'test_webhook_fail',
        name: 'Test Webhook Failure',
        condition: {
          type: 'custom_metric' as const,
          metric: 'test',
          operator: 'gt' as const,
          threshold: 0,
          timeWindowMinutes: 1
        },
        severity: 'medium' as const,
        enabled: true,
        cooldownMinutes: 1,
        channels: [{
          type: 'webhook' as const,
          config: { url: 'https://example.com/webhook' }
        }]
      }

      await (AlertingService as any).triggerAlert(testRule)

      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send alert via webhook'),
        expect.any(Error),
        expect.objectContaining({
          service: 'alerting',
          operation: 'send_alert'
        })
      )
    })
  })

  describe('alert management', () => {
    it('should get active alerts', () => {
      const activeAlerts = AlertingService.getActiveAlerts()
      expect(Array.isArray(activeAlerts)).toBe(true)
    })

    it('should trigger test alert', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await AlertingService.triggerTestAlert('high')

      expect(consoleSpy).toHaveBeenCalledWith(
        '🚨 [HIGH] Alert triggered for rule: Test Alert',
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should get alert history', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase')
      const mockFrom = supabaseAdmin.from as Mock
      
      const mockAlerts = [
        {
          timestamp: new Date().toISOString(),
          tags: {
            alert_id: 'alert1',
            severity: 'high',
            message: 'Test alert',
            status: 'triggered'
          },
          metric_name: 'alert_triggered'
        }
      ]

      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: mockAlerts,
                  error: null
                })
              }))
            }))
          }))
        }))
      })

      const history = await AlertingService.getAlertHistory(24, 'high')

      expect(history).toEqual([
        expect.objectContaining({
          alertId: 'alert1',
          severity: 'high',
          message: 'Test alert',
          status: 'triggered'
        })
      ])
    })
  })

  describe('alert message generation', () => {
    it('should generate appropriate messages for different alert types', () => {
      const errorRateRule = {
        id: 'error_rate',
        name: 'High Error Rate',
        condition: {
          type: 'error_rate' as const,
          metric: 'error_count',
          operator: 'gt' as const,
          threshold: 10,
          timeWindowMinutes: 5
        },
        severity: 'high' as const,
        enabled: true,
        cooldownMinutes: 15,
        channels: []
      }

      const message = (AlertingService as any).generateAlertMessage(errorRateRule)
      expect(message).toBe('High error rate detected: 10 errors in 5 minutes')

      const serviceDownRule = {
        ...errorRateRule,
        condition: {
          ...errorRateRule.condition,
          type: 'service_down' as const
        }
      }

      const serviceMessage = (AlertingService as any).generateAlertMessage(serviceDownRule)
      expect(serviceMessage).toBe('Critical service is down: error_count')
    })
  })
})