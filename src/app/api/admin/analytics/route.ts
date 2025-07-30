import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-middleware'
import { UsageTrackingService } from '@/services/usage-tracking.service'
import { LoggingService } from '@/services/logging.service'

/**
 * GET /api/admin/analytics
 * Get system analytics for admin dashboard
 */
async function handleAnalyticsGet(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  LoggingService.info('Admin analytics requested', {
    service: 'admin-api',
    operation: 'get_analytics',
    endpoint: '/api/admin/analytics',
    method: 'GET',
    metadata: { startDate, endDate }
  })

  try {
    // Get system-wide analytics
    const systemAnalytics = await UsageTrackingService.getSystemAnalytics(
      startDate || undefined,
      endDate || undefined
    )

    // Get additional metrics from logging service
    const hours = 24
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const [
      requestMetrics,
      errorMetrics,
      responseTimeMetrics
    ] = await Promise.all([
      LoggingService.getMetrics('request_count', startTime, new Date(), 1000),
      LoggingService.getMetrics('error_count', startTime, new Date(), 1000),
      LoggingService.getMetrics('response_time', startTime, new Date(), 1000)
    ])

    // Calculate additional statistics
    const totalRequests = requestMetrics.reduce((sum, metric) => sum + metric.value, 0)
    const totalErrors = errorMetrics.reduce((sum, metric) => sum + metric.value, 0)
    const avgResponseTime = responseTimeMetrics.length > 0 
      ? responseTimeMetrics.reduce((sum, metric) => sum + metric.value, 0) / responseTimeMetrics.length
      : 0

    // Group metrics by hour for trending
    const hourlyStats = requestMetrics.reduce((acc, metric) => {
      const hour = new Date(metric.timestamp!).toISOString().substring(0, 13)
      if (!acc[hour]) {
        acc[hour] = { requests: 0, errors: 0, responseTime: [] }
      }
      acc[hour].requests += metric.value
      return acc
    }, {} as Record<string, { requests: number; errors: number; responseTime: number[] }>)

    // Add error data to hourly stats
    errorMetrics.forEach(metric => {
      const hour = new Date(metric.timestamp!).toISOString().substring(0, 13)
      if (hourlyStats[hour]) {
        hourlyStats[hour].errors += metric.value
      }
    })

    // Add response time data to hourly stats
    responseTimeMetrics.forEach(metric => {
      const hour = new Date(metric.timestamp!).toISOString().substring(0, 13)
      if (hourlyStats[hour]) {
        hourlyStats[hour].responseTime.push(metric.value)
      }
    })

    // Convert hourly stats to array and calculate averages
    const hourlyTrends = Object.entries(hourlyStats)
      .map(([hour, stats]) => ({
        hour,
        requests: stats.requests,
        errors: stats.errors,
        errorRate: stats.requests > 0 ? (stats.errors / stats.requests) * 100 : 0,
        avgResponseTime: stats.responseTime.length > 0 
          ? stats.responseTime.reduce((sum, time) => sum + time, 0) / stats.responseTime.length
          : 0
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

    const analytics = {
      ...systemAnalytics,
      realTimeStats: {
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        avgResponseTime: Math.round(avgResponseTime)
      },
      trends: {
        hourly: hourlyTrends,
        timeRange: {
          start: startTime.toISOString(),
          end: new Date().toISOString(),
          hours
        }
      }
    }

    return NextResponse.json({
      success: true,
      analytics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    LoggingService.error('Failed to get analytics', error as Error, {
      service: 'admin-api',
      operation: 'get_analytics'
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const GET = withErrorHandler(handleAnalyticsGet)