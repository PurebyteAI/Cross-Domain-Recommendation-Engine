import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UserProfileService } from '@/lib/database'
import { PersonalizationService } from '@/services/personalization.service'

export async function POST(request: NextRequest) {
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

    // Learn user preferences from their history
    const preferences = await PersonalizationService.learnUserPreferences(userProfile.data.id)

    if (!preferences) {
      return NextResponse.json({
        success: true,
        message: 'No sufficient history to learn preferences yet',
        preferences: null
      })
    }

    // Schedule background preference learning for continuous improvement
    await PersonalizationService.schedulePreferenceLearning(userProfile.data.id)

    return NextResponse.json({
      success: true,
      message: 'Preferences learned successfully',
      preferences: {
        totalInteractions: preferences.totalInteractions,
        averageConfidence: preferences.averageConfidence,
        topDomains: Object.entries(preferences.preferredDomains)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([domain, score]) => ({ domain, score })),
        topThemes: Object.entries(preferences.commonThemes)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([theme, frequency]) => ({ theme, frequency })),
        personalityProfile: preferences.personalityProfile,
        lastUpdated: preferences.lastUpdated
      }
    })
  } catch (error) {
    console.error('Error learning user preferences:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Get personalization insights
    const insights = await PersonalizationService.getPersonalizationInsights(userProfile.data.id)

    return NextResponse.json({
      success: true,
      insights
    })
  } catch (error) {
    console.error('Error getting personalization insights:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}