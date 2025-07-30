import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UserTasteHistoryService, UserProfileService } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile to get internal user ID
    const userProfile = await UserProfileService.getByClerkId(userId)
    if (!userProfile.success || !userProfile.data) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch user's taste history
    const historyResult = await UserTasteHistoryService.getByUserId(
      userProfile.data.id,
      limit,
      offset
    )

    if (!historyResult.success) {
      return NextResponse.json(
        { success: false, error: historyResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      history: historyResult.data,
      count: historyResult.count,
      hasMore: historyResult.data.length === limit
    })
  } catch (error) {
    console.error('Error fetching recommendation history:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile to get internal user ID
    const userProfile = await UserProfileService.getByClerkId(userId)
    if (!userProfile.success || !userProfile.data) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Delete all history for the user (keep last 30 days for analytics)
    const result = await UserTasteHistoryService.deleteOldHistory(
      userProfile.data.id,
      0 // Delete all history
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.data,
      message: 'Recommendation history cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing recommendation history:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}