import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-middleware'
import { HealthCheckService } from '@/services/health-check.service'
import { LoggingService } from '@/services/logging.service'

/**
 * GET /api/admin/health
 * Basic health check for admin dashboard
 */
async function handleHealthGet(request: NextRequest): Promise<NextResponse> {
  LoggingService.info('Admin health check requested', {
    service: 'admin-api',
    operation: 'health_check',
    endpoint: '/api/admin/health',
    method: 'GET'
  })

  const health = await HealthCheckService.performHealthCheck(false)
  
  return NextResponse.json(health, {
    status: health.overall === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': health.overall === 'healthy' ? 'pass' : 'fail'
    }
  })
}

/**
 * POST /api/admin/health
 * Detailed health check for admin dashboard
 */
async function handleHealthPost(request: NextRequest): Promise<NextResponse> {
  LoggingService.info('Admin detailed health check requested', {
    service: 'admin-api',
    operation: 'detailed_health_check',
    endpoint: '/api/admin/health',
    method: 'POST'
  })

  const health = await HealthCheckService.performHealthCheck(true)
  
  return NextResponse.json(health, {
    status: health.overall === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': health.overall === 'healthy' ? 'pass' : 'fail',
      'X-Health-Check-Type': 'detailed'
    }
  })
}

export const GET = withErrorHandler(handleHealthGet)
export const POST = withErrorHandler(handleHealthPost)