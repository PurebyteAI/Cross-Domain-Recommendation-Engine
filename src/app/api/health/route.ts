import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-middleware'
import { HealthCheckService } from '@/services/health-check.service'
import { LoggingService } from '@/services/logging.service'

/**
 * GET /api/health
 * Health check endpoint for monitoring system status
 * Requirements: 7.3, 7.4
 */
async function handleHealthGet(request: NextRequest): Promise<NextResponse> {
  LoggingService.info('Health check requested', {
    service: 'health-api',
    operation: 'basic_health_check',
    endpoint: '/api/health',
    method: 'GET'
  })

  const health = await HealthCheckService.performHealthCheck(false)
  
  // Convert services array to object format for backward compatibility
  const services = health.services.reduce((acc, service) => {
    acc[service.service] = {
      healthy: service.healthy,
      responseTime: service.responseTime,
      error: service.error,
      details: service.details
    }
    return acc
  }, {} as Record<string, any>)

  const response = {
    status: health.overall === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: health.timestamp.toISOString(),
    responseTime: health.services.reduce((sum, s) => sum + s.responseTime, 0),
    services,
    version: health.version,
    environment: health.environment
  }

  return NextResponse.json(response, {
    status: health.overall === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': health.overall === 'healthy' ? 'pass' : 'fail'
    }
  })
}

/**
 * POST /api/health
 * Detailed health check with more comprehensive testing
 */
async function handleHealthPost(request: NextRequest): Promise<NextResponse> {
  LoggingService.info('Detailed health check requested', {
    service: 'health-api',
    operation: 'detailed_health_check',
    endpoint: '/api/health',
    method: 'POST'
  })

  const health = await HealthCheckService.performHealthCheck(true)
  
  // Convert services array to object format for backward compatibility
  const services = health.services.reduce((acc, service) => {
    acc[service.service] = {
      healthy: service.healthy,
      responseTime: service.responseTime,
      error: service.error,
      details: service.details
    }
    return acc
  }, {} as Record<string, any>)

  const response = {
    status: health.overall === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: health.timestamp.toISOString(),
    responseTime: health.services.reduce((sum, s) => sum + s.responseTime, 0),
    services,
    version: health.version,
    environment: health.environment,
    testType: 'detailed'
  }

  return NextResponse.json(response, {
    status: health.overall === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': health.overall === 'healthy' ? 'pass' : 'fail',
      'X-Health-Check-Type': 'detailed'
    }
  })
}

// Export wrapped handlers with centralized error handling
export const GET = withErrorHandler(handleHealthGet)
export const POST = withErrorHandler(handleHealthPost)