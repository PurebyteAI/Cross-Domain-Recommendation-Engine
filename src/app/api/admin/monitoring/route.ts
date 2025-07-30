/**
 * Admin Monitoring API Endpoint
 * 
 * Provides monitoring data and system health information for administrators.
 * This endpoint is protected and requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  supabaseMonitoring, 
  healthMonitor, 
  performanceMonitor 
} from '@/lib/monitoring';

export async function GET(request: NextRequest) {
  let userId: string | null = null;
  
  try {
    // Check authentication
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Add admin role check here
    // For now, any authenticated user can access monitoring data

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const hours = parseInt(searchParams.get('hours') || '24');

    switch (type) {
      case 'health':
        const healthData = await healthMonitor.getSystemHealth();
        return NextResponse.json({
          success: true,
          data: healthData
        });

      case 'metrics':
        const metrics = await supabaseMonitoring.getHealthMetrics();
        return NextResponse.json({
          success: true,
          data: metrics
        });

      case 'errors':
        const errors = await supabaseMonitoring.getErrorSummary(hours);
        return NextResponse.json({
          success: true,
          data: errors
        });

      case 'overview':
      default:
        // Get comprehensive overview
        const [health, recentMetrics, recentErrors] = await Promise.all([
          healthMonitor.getSystemHealth(),
          supabaseMonitoring.getHealthMetrics(),
          supabaseMonitoring.getErrorSummary(24)
        ]);

        // Calculate summary statistics
        const errorCount = recentErrors.length;
        const avgResponseTime = recentMetrics
          .filter(m => m.metric_name === 'api_performance')
          .reduce((sum, m) => sum + m.metric_value, 0) / 
          Math.max(1, recentMetrics.filter(m => m.metric_name === 'api_performance').length);

        const uptime = health.healthPercentage;

        return NextResponse.json({
          success: true,
          data: {
            overview: {
              uptime: `${uptime.toFixed(1)}%`,
              avgResponseTime: `${avgResponseTime.toFixed(0)}ms`,
              errorCount24h: errorCount,
              servicesHealthy: Object.values(health.services).filter(Boolean).length,
              totalServices: Object.keys(health.services).length
            },
            health,
            recentMetrics: recentMetrics.slice(0, 50),
            recentErrors: recentErrors.slice(0, 20)
          }
        });
    }
  } catch (error) {
    console.error('Monitoring API error:', error);
    
    // Log the error
    await supabaseMonitoring.logError({
      message: error instanceof Error ? error.message : 'Unknown monitoring API error',
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        endpoint: '/api/admin/monitoring',
        method: 'GET'
      },
      userId: userId || undefined
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch monitoring data' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'log_metric':
        await supabaseMonitoring.logMetric(data);
        return NextResponse.json({
          success: true,
          message: 'Metric logged successfully'
        });

      case 'log_error':
        await supabaseMonitoring.logError({
          ...data,
          userId
        });
        return NextResponse.json({
          success: true,
          message: 'Error logged successfully'
        });

      case 'health_check':
        const healthData = await healthMonitor.checkExternalServices();
        return NextResponse.json({
          success: true,
          data: healthData
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Monitoring POST API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process monitoring request' 
      },
      { status: 500 }
    );
  }
}