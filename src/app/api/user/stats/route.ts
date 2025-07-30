import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { UserProfileService } from '@/services/user-profile.service'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const stats = await UserProfileService.getUserStats(userId)
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}