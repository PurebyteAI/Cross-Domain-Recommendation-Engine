import { supabaseAdmin, executeQuery, executeListQuery } from '@/lib/supabase'
import { UserProfile, UserProfileUpdate } from '@/types/database'

export class UserProfileService {
  /**
   * Get or create user profile using Supabase function
   */
  static async getOrCreateProfile(
    clerkUserId: string,
    email: string,
    displayName?: string | null
  ): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_or_create_user_profile', {
        clerk_id: clerkUserId,
        user_email: email,
        user_display_name: displayName
      })

      if (error) {
        console.error('Error getting/creating user profile via RPC:', error)
        
        // Try a fallback approach if RPC fails
        // First check if profile already exists
        const existingProfile = await this.getProfileByClerkId(clerkUserId)
        if (existingProfile) {
          return existingProfile
        }
        
        // If not, try to create one directly
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            clerk_user_id: clerkUserId,
            email: email,
            display_name: displayName || null,
            tier: 'free',
            usage_limit: 50,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
          
        if (createError) {
          console.error('Error creating user profile directly:', createError)
          return null
        }
        
        return newProfile
      }

      return data
    } catch (error) {
      console.error('Exception in getOrCreateProfile:', error)
      return null
    }
  }

  /**
   * Get user profile by Clerk user ID
   */
  static async getProfileByClerkId(clerkUserId: string): Promise<UserProfile | null> {
    try {
      // Try using the RPC function first
      const { data, error } = await supabaseAdmin.rpc('get_user_profile_by_clerk_id', {
        clerk_id: clerkUserId
      })

      if (error) {
        console.error('Error getting user profile via RPC:', error)

        // Fallback to direct table query
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('clerk_user_id', clerkUserId)
          .single()

        if (fallbackError) {
          console.error('Error getting user profile via direct query:', fallbackError)
          return null
        }

        return fallbackData
      }

      return data
    } catch (error) {
      console.error('Exception in getProfileByClerkId:', error)
      return null
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    clerkUserId: string,
    updates: UserProfileUpdate
  ): Promise<UserProfile | null> {
    const result = await executeQuery(async () => {
      return await supabaseAdmin
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', clerkUserId)
        .select()
        .single()
    })

    return result.success ? result.data : null
  }

  /**
   * Update user tier (for admin operations)
   */
  static async updateUserTier(
    clerkUserId: string,
    tier: 'free' | 'premium' | 'enterprise',
    usageLimit?: number
  ): Promise<UserProfile | null> {
    const updates: UserProfileUpdate = {
      tier,
      updated_at: new Date().toISOString()
    }

    if (usageLimit !== undefined) {
      updates.usage_limit = usageLimit
    }

    return await this.updateProfile(clerkUserId, updates)
  }

  /**
   * Check if user has exceeded usage limit
   */
  static async checkUsageLimit(clerkUserId: string): Promise<boolean> {
    try {
      // In development, be more lenient
      const isDevelopment = process.env.NODE_ENV === 'development'
      if (isDevelopment) {
        return true // Allow all requests in development
      }

      // Try using the RPC function first
      const { data, error } = await supabaseAdmin.rpc('check_user_usage_limit', {
        check_date: new Date().toISOString().split('T')[0],
        clerk_id: clerkUserId
      })

      if (error) {
        console.error('Error checking usage limit via RPC:', error)

        // Fallback to manual check
        const profile = await this.getProfileByClerkId(clerkUserId)
        if (!profile) {
          return true // Allow if no profile found
        }

        const todayUsage = await this.getTodayUsage(clerkUserId)
        return todayUsage < profile.usage_limit
      }

      return data
    } catch (error) {
      console.error('Exception in checkUsageLimit:', error)
      return true // Allow request if we can't check
    }
  }

  /**
   * Get user's current usage for today
   */
  static async getTodayUsage(clerkUserId: string): Promise<number> {
    try {
      // First get the user profile to get the internal user ID
      const profile = await this.getProfileByClerkId(clerkUserId)
      if (!profile) {
        return 0
      }

      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabaseAdmin
        .from('api_usage')
        .select('request_count')
        .eq('user_id', profile.id)
        .eq('date', today)

      if (error) {
        console.error('Error getting today usage:', error)
        return 0
      }

      return data?.reduce((sum, row) => sum + row.request_count, 0) || 0
    } catch (error) {
      console.error('Exception in getTodayUsage:', error)
      return 0
    }
  }

  /**
   * Get all user profiles (admin function)
   */
  static async getAllProfiles(
    limit: number = 50,
    offset: number = 0
  ): Promise<UserProfile[]> {
    const result = await executeListQuery(async () => {
      const queryResult = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      return {
        data: queryResult.data,
        error: queryResult.error,
        count: queryResult.count || undefined
      }
    })

    return result.success ? result.data : []
  }

  /**
   * Delete user profile (admin function)
   */
  static async deleteProfile(clerkUserId: string): Promise<boolean> {
    const result = await executeQuery(async () => {
      return await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('clerk_user_id', clerkUserId)
        .select()
        .single()
    })

    return result.success
  }

  /**
   * Get user statistics for dashboard
   */
  static async getUserStats(clerkUserId: string): Promise<{
    totalRecommendations: number
    matchRate: number
    connectedDomains: number
    dailyLimit: number
    requestsToday: number
    averageResponseTime: number
    favoriteEndpoints: string[]
    tier: string
    lastActive: string | null
  }> {
    try {
      // Get user profile to get user_id
      const profile = await this.getProfileByClerkId(clerkUserId)
      if (!profile) {
        return {
          totalRecommendations: 0,
          matchRate: 0,
          connectedDomains: 0,
          dailyLimit: 50,
          requestsToday: 0,
          averageResponseTime: 0,
          favoriteEndpoints: [],
          tier: 'free',
          lastActive: null
        }
      }

      const today = new Date().toISOString().split('T')[0]

      // Get all requests data
      const { data: allRequestsData } = await supabaseAdmin
        .from('api_usage')
        .select('request_count, endpoint, response_time_ms, error_count')
        .eq('user_id', profile.id)

      const totalRequests = allRequestsData?.reduce((sum, row) => sum + row.request_count, 0) || 0
      const totalErrors = allRequestsData?.reduce((sum, row) => sum + (row.error_count || 0), 0) || 0

      // Get today's requests
      const { data: todayData } = await supabaseAdmin
        .from('api_usage')
        .select('request_count')
        .eq('user_id', profile.id)
        .eq('date', today)

      const requestsToday = todayData?.reduce((sum, row) => sum + row.request_count, 0) || 0

      // Get average response time
      const { data: responseTimeData } = await supabaseAdmin
        .from('api_usage')
        .select('response_time_ms')
        .eq('user_id', profile.id)
        .not('response_time_ms', 'is', null)

      const averageResponseTime = responseTimeData?.length
        ? responseTimeData.reduce((sum, row) => sum + (row.response_time_ms || 0), 0) / responseTimeData.length
        : 0

      // Get favorite endpoints
      const { data: endpointData } = await supabaseAdmin
        .from('api_usage')
        .select('endpoint, request_count')
        .eq('user_id', profile.id)
        .order('request_count', { ascending: false })
        .limit(5)

      const favoriteEndpoints = endpointData?.map(row => row.endpoint) || []

      // Calculate match rate (success rate)
      const successfulRequests = totalRequests - totalErrors
      const matchRate = totalRequests > 0 
        ? Math.round((successfulRequests / totalRequests) * 100)
        : 0

      // Count unique recommendation endpoints as connected domains
      const recommendationEndpoints = allRequestsData?.filter(
        row => row.endpoint && row.endpoint.includes('/recommendations')
      ) || []
      const uniqueEndpoints = new Set(recommendationEndpoints.map(row => row.endpoint))
      const connectedDomains = Math.max(1, uniqueEndpoints.size)

      // Get tier-based daily limit
      const tierLimits = {
        free: 50,
        premium: 500,
        enterprise: 5000
      }
      const dailyLimit = tierLimits[profile.tier as keyof typeof tierLimits] || 50

      return {
        totalRecommendations: totalRequests,
        matchRate: Math.min(matchRate, 100), // Cap at 100%
        connectedDomains,
        dailyLimit,
        requestsToday,
        averageResponseTime: Math.round(averageResponseTime),
        favoriteEndpoints,
        tier: profile.tier,
        lastActive: profile.updated_at || profile.created_at
      }
    } catch (error) {
      console.error('Error getting user stats:', error)
      return {
        totalRecommendations: 0,
        matchRate: 0,
        connectedDomains: 0,
        dailyLimit: 50,
        requestsToday: 0,
        averageResponseTime: 0,
        favoriteEndpoints: [],
        tier: 'free',
        lastActive: null
      }
    }
  }
}