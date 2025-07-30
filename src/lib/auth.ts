import { auth } from '@clerk/nextjs/server'
import { UserProfileService } from '@/services/user-profile.service'
import { UserProfile } from '@/types/database'

/**
 * Get the current authenticated user's profile
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return null
    }

    return await UserProfileService.getProfileByClerkId(userId)
  } catch (error) {
    console.error('Error getting current user profile:', error)
    return null
  }
}

/**
 * Check if the current user has exceeded their usage limit
 */
export async function checkCurrentUserUsageLimit(): Promise<boolean> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return false
    }

    return await UserProfileService.checkUsageLimit(userId)
  } catch (error) {
    console.error('Error checking current user usage limit:', error)
    return false // Allow request if we can't check
  }
}

/**
 * Get or create user profile for the current authenticated user
 */
export async function getOrCreateCurrentUserProfile(
  email: string,
  displayName?: string | null
): Promise<UserProfile | null> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return null
    }

    return await UserProfileService.getOrCreateProfile(userId, email, displayName)
  } catch (error) {
    console.error('Error getting/creating current user profile:', error)
    return null
  }
}

/**
 * Require authentication and return user profile
 * Throws error if user is not authenticated
 */
export async function requireAuth(): Promise<{
  userId: string
  profile: UserProfile
}> {
  const { userId } = await auth()
  
  if (!userId) {
    throw new Error('Authentication required')
  }

  const profile = await UserProfileService.getProfileByClerkId(userId)
  
  if (!profile) {
    throw new Error('User profile not found')
  }

  return { userId, profile }
}

/**
 * Check if user has permission for a specific tier
 */
export function hasPermission(
  userTier: string,
  requiredTier: 'free' | 'premium' | 'enterprise'
): boolean {
  const tierHierarchy = {
    free: 0,
    premium: 1,
    enterprise: 2
  }

  const userLevel = tierHierarchy[userTier as keyof typeof tierHierarchy] ?? -1
  const requiredLevel = tierHierarchy[requiredTier]

  return userLevel >= requiredLevel
}

/**
 * Get usage limits based on user tier
 */
export function getUsageLimits(tier: string): {
  dailyRequests: number
  rateLimitPerMinute: number
  features: string[]
} {
  switch (tier) {
    case 'premium':
      return {
        dailyRequests: 1000,
        rateLimitPerMinute: 60,
        features: ['cross_domain_recommendations', 'explanations', 'history', 'priority_support']
      }
    case 'enterprise':
      return {
        dailyRequests: 10000,
        rateLimitPerMinute: 300,
        features: ['cross_domain_recommendations', 'explanations', 'history', 'priority_support', 'custom_domains', 'analytics']
      }
    default: // free
      return {
        dailyRequests: 100,
        rateLimitPerMinute: 10,
        features: ['cross_domain_recommendations', 'explanations']
      }
  }
}