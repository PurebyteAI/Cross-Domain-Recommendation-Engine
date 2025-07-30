import { supabase, supabaseAdmin, executeQuery, executeListQuery, DatabaseResult, DatabaseListResult } from './supabase'
import { 
  UserProfile, 
  UserProfileInsert, 
  UserProfileUpdate,
  UserTasteHistory,
  UserTasteHistoryInsert,
  ApiUsage,
  ApiUsageInsert,
  CachedExplanation,
  CachedExplanationInsert,
  SystemMetric,
  SystemMetricInsert
} from '../types/database'

// User Profile Operations
export class UserProfileService {
  static async getByClerkId(clerkUserId: string): Promise<DatabaseResult<UserProfile>> {
    return executeQuery(async () => {
      return await supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single()
    })
  }

  static async getOrCreate(
    clerkUserId: string, 
    email: string, 
    displayName?: string
  ): Promise<DatabaseResult<UserProfile>> {
    return executeQuery(async () => {
      return await supabaseAdmin.rpc('get_or_create_user_profile', {
        clerk_id: clerkUserId,
        user_email: email,
        user_display_name: displayName || null
      })
    })
  }

  static async create(profile: UserProfileInsert): Promise<DatabaseResult<UserProfile>> {
    return executeQuery(async () => {
      return await supabase
        .from('user_profiles')
        .insert(profile)
        .select()
        .single()
    })
  }

  static async update(id: string, updates: UserProfileUpdate): Promise<DatabaseResult<UserProfile>> {
    return executeQuery(async () => {
      return await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    })
  }

  static async checkUsageLimit(clerkUserId: string): Promise<DatabaseResult<boolean>> {
    return executeQuery(async () => {
      return await supabaseAdmin.rpc('check_user_usage_limit', {
        clerk_id: clerkUserId
      })
    })
  }
}

// User Taste History Operations
export class UserTasteHistoryService {
  static async create(history: UserTasteHistoryInsert): Promise<DatabaseResult<UserTasteHistory>> {
    return executeQuery(async () => {
      return await supabase
        .from('user_taste_history')
        .insert(history)
        .select()
        .single()
    })
  }

  static async getByUserId(
    userId: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<DatabaseListResult<UserTasteHistory>> {
    return executeListQuery(async () => {
      const result = await supabase
        .from('user_taste_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      return {
        data: result.data,
        error: result.error,
        count: result.count || undefined
      }
    })
  }

  static async getBySessionId(sessionId: string): Promise<DatabaseListResult<UserTasteHistory>> {
    return executeListQuery(async () => {
      const result = await supabase
        .from('user_taste_history')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
      
      return {
        data: result.data,
        error: result.error,
        count: result.count || undefined
      }
    })
  }

  static async deleteOldHistory(userId: string, daysToKeep: number = 90): Promise<DatabaseResult<number>> {
    return executeQuery(async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      const { data, error } = await supabase
        .from('user_taste_history')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString())
        .select('id')
      
      return { data: data?.length || 0, error }
    })
  }
}

// API Usage Tracking Operations
export class ApiUsageService {
  static async recordUsage(usage: ApiUsageInsert): Promise<DatabaseResult<ApiUsage>> {
    return executeQuery(async () => {
      return await supabaseAdmin
        .from('api_usage')
        .insert(usage)
        .select()
        .single()
    })
  }

  static async getDailyUsage(userId: string, date?: string): Promise<DatabaseResult<number>> {
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('api_usage')
        .select('request_count')
        .eq('user_id', userId)
        .eq('date', targetDate)
      
      if (error) return { data: null, error }
      
      const totalUsage = data?.reduce((sum, record) => sum + record.request_count, 0) || 0
      return { data: totalUsage, error: null }
    })
  }

  static async getUsageStats(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<DatabaseListResult<ApiUsage>> {
    return executeListQuery(async () => {
      const result = await supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
      
      return {
        data: result.data,
        error: result.error,
        count: result.count || undefined
      }
    })
  }
}

// Cached Explanations Operations
export class CachedExplanationService {
  static async get(
    inputEntityHash: string, 
    recommendedEntityHash: string
  ): Promise<DatabaseResult<CachedExplanation>> {
    return executeQuery(async () => {
      return await supabase
        .from('cached_explanations')
        .select('*')
        .eq('input_entity_hash', inputEntityHash)
        .eq('recommended_entity_hash', recommendedEntityHash)
        .gt('expires_at', new Date().toISOString())
        .single()
    })
  }

  static async create(explanation: CachedExplanationInsert): Promise<DatabaseResult<CachedExplanation>> {
    return executeQuery(async () => {
      return await supabaseAdmin
        .from('cached_explanations')
        .upsert(explanation, { 
          onConflict: 'input_entity_hash,recommended_entity_hash' 
        })
        .select()
        .single()
    })
  }

  static async cleanupExpired(): Promise<DatabaseResult<number>> {
    return executeQuery(async () => {
      return await supabaseAdmin.rpc('cleanup_expired_explanations')
    })
  }
}

// System Metrics Operations
export class SystemMetricsService {
  static async record(metric: SystemMetricInsert): Promise<DatabaseResult<SystemMetric>> {
    return executeQuery(async () => {
      return await supabaseAdmin
        .from('system_metrics')
        .insert(metric)
        .select()
        .single()
    })
  }

  static async getMetrics(
    metricName: string,
    startTime: string,
    endTime: string,
    limit: number = 1000
  ): Promise<DatabaseListResult<SystemMetric>> {
    return executeListQuery(async () => {
      const result = await supabaseAdmin
        .from('system_metrics')
        .select('*')
        .eq('metric_name', metricName)
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: false })
        .limit(limit)
      
      return {
        data: result.data,
        error: result.error,
        count: result.count || undefined
      }
    })
  }

  static async recordResponseTime(endpoint: string, responseTime: number): Promise<void> {
    await this.record({
      metric_name: 'response_time',
      metric_value: responseTime,
      tags: { endpoint }
    })
  }

  static async recordError(endpoint: string, errorType: string): Promise<void> {
    await this.record({
      metric_name: 'error_count',
      metric_value: 1,
      tags: { endpoint, error_type: errorType }
    })
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      return { healthy: false, error: error.message }
    }
    
    return { healthy: true }
  } catch (err) {
    return { 
      healthy: false, 
      error: err instanceof Error ? err.message : 'Unknown database error' 
    }
  }
}

// Utility function to generate entity hash for caching
export function generateEntityHash(entity: any): string {
  const crypto = require('crypto')
  const entityString = JSON.stringify(entity, Object.keys(entity).sort())
  return crypto.createHash('sha256').update(entityString).digest('hex').substring(0, 32)
}