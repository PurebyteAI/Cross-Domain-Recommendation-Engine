import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-middleware'
import { LoggingService } from '@/services/logging.service'

/**
 * GET /api/admin/metrics
 * Get system metrics for admin dashboard
 */
async function handleMetricsGet(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const metricName = searchParams.get('metric')
  const hours = parseInt(searchParams.get('hours') || '24', 10)
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  LoggingService.info('Admin metrics requested', {
    service: 'admin-api',
    operation: 'get_metrics',
    endpoint: '/api/admin/metrics',
    method: 'GET',
    metadata: { metricName, hours, limit }
  })

  const startTime = new Date()
  startTime.setHours(startTime.getHours() - hours)

  const metrics = await LoggingService.getMetrics(
    metricName || undefined,
    startTime,
    new Date(),
    limit
  )

  // Group metrics by name for better dashboard display
  const groupedMetrics = metrics.reduce((acc, metric) => {
    if (!acc[metric.name]) {
      acc[metric.name] = []
    }
    acc[metric.name].push(metric)
    return acc
  }, {} as Record<string, typeof metrics>)

  // Get latest value for each metric
  const latestMetrics = Object.entries(groupedMetrics).map(([name, metricList]) => {
    const latest = metricList.sort((a, b) => 
      new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
    )[0]
    
    return {
      name,
      value: latest.value,
      unit: latest.unit,
      tags: latest.tags,
      timestamp: latest.timestamp,
      count: metricList.length,
      history: metricList.slice(0, 10) // Last 10 values for trend
    }
  })

  return NextResponse.json({
    success: true,
    metrics: latestMetrics,
    totalCount: metrics.length,
    timeRange: {
      start: startTime.toISOString(),
      end: new Date().toISOString(),
      hours
    }
  })
}

export const GET = withErrorHandler(handleMetricsGet)