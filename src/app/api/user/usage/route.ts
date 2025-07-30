import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { RateLimiterService } from '@/services/rate-limiter.service'
import { UsageTrackingService } from '@/services/usage-tracking.service'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    // Get usage statistics and analytics
    const [usageStats, analytics] = await Promise.all([
      RateLimiterService.getUserUsageStats(userId),
      UsageTrackingService.getUserAnalytics(userId, startDate, endDate),
    ])

    const responseTime = Date.now() - startTime

    // Track this request
    await UsageTrackingService.trackRequest({
      clerkUserId: userId,
      endpoint: '/api/user/usage',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: responseTime,
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        currentUsage: usageStats,
        analytics,
        generatedAt: new Date().toISOString(),
      },
    })

  } catch (error) {
    console.error('Error fetching user usage:', error)
    
    const responseTime = Date.now() - startTime
    const { userId } = await auth()
    
    if (userId) {
      await UsageTrackingService.trackRequest({
        clerkUserId: userId,
        endpoint: '/api/user/usage',
        method: 'GET',
        statusCode: 500,
        responseTimeMs: responseTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch usage data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Reset user's rate limits (useful for testing or admin actions)
    await RateLimiterService.resetUserLimits(userId)

    const responseTime = Date.now() - startTime

    // Track this request
    await UsageTrackingService.trackRequest({
      clerkUserId: userId,
      endpoint: '/api/user/usage',
      method: 'DELETE',
      statusCode: 200,
      responseTimeMs: responseTime,
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Rate limits reset successfully',
    })

  } catch (error) {
    console.error('Error resetting user limits:', error)
    
    const responseTime = Date.now() - startTime
    const { userId } = await auth()
    
    if (userId) {
      await UsageTrackingService.trackRequest({
        clerkUserId: userId,
        endpoint: '/api/user/usage',
        method: 'DELETE',
        statusCode: 500,
        responseTimeMs: responseTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reset rate limits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}