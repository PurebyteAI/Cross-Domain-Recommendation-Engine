import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-middleware'
import { AlertingService } from '@/services/alerting.service'
import { LoggingService } from '@/services/logging.service'

/**
 * POST /api/admin/alerts/test
 * Trigger a test alert for testing the alerting system
 */
async function handleTestAlertPost(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}))
  const severity = body.severity || 'medium'

  LoggingService.info('Test alert triggered', {
    service: 'admin-api',
    operation: 'trigger_test_alert',
    endpoint: '/api/admin/alerts/test',
    method: 'POST',
    metadata: { severity }
  })

  try {
    await AlertingService.triggerTestAlert(severity)

    return NextResponse.json({
      success: true,
      message: `Test alert with severity '${severity}' has been triggered`,
      severity,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    LoggingService.error('Failed to trigger test alert', error as Error, {
      service: 'admin-api',
      operation: 'trigger_test_alert',
      metadata: { severity }
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to trigger test alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const POST = withErrorHandler(handleTestAlertPost)