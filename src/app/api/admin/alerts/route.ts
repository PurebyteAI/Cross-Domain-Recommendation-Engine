import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-middleware'
import { AlertingService } from '@/services/alerting.service'
import { LoggingService } from '@/services/logging.service'

/**
 * GET /api/admin/alerts
 * Get alerts for admin dashboard
 */
async function handleAlertsGet(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const hours = parseInt(searchParams.get('hours') || '24', 10)
  const severity = searchParams.get('severity')

  LoggingService.info('Admin alerts requested', {
    service: 'admin-api',
    operation: 'get_alerts',
    endpoint: '/api/admin/alerts',
    method: 'GET',
    metadata: { hours, severity }
  })

  // Get alert history
  const alertHistory = await AlertingService.getAlertHistory(
    hours,
    severity || undefined
  )

  // Get active alerts
  const activeAlerts = AlertingService.getActiveAlerts()

  // Calculate statistics
  const stats = {
    total: alertHistory.length,
    active: activeAlerts.length,
    bySeverity: alertHistory.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byStatus: alertHistory.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  return NextResponse.json({
    success: true,
    alerts: alertHistory,
    activeAlerts: activeAlerts.map(alert => ({
      id: alert.id,
      ruleId: alert.ruleId,
      ruleName: alert.ruleName,
      severity: alert.severity,
      message: alert.message,
      triggeredAt: alert.triggeredAt.toISOString(),
      status: alert.status
    })),
    stats,
    timeRange: {
      hours,
      start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    }
  })
}

export const GET = withErrorHandler(handleAlertsGet)