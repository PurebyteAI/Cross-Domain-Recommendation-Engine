import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client configuration for production
const clientConfig = {
  global: {
    // Global fetch configuration for better performance
    fetch: (url: RequestInfo | URL, init?: RequestInit) => {
      return fetch(url, {
        ...init,
        // Add connection keep-alive for better performance
        keepalive: true,
        // Set reasonable timeout
        signal: AbortSignal.timeout(30000),
      })
    },
  },
  auth: {
    // Optimize auth token handling
    detectSessionInUrl: false,
    flowType: 'pkce' as const,
    autoRefreshToken: true,
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
}

export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  clientConfig
)

// Service role client for server-side operations with optimized settings
export const supabaseAdmin: SupabaseClient<Database> = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    ...clientConfig,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  }
)

// Connection pool monitoring
const connectionStats = {
  activeConnections: 0,
  totalQueries: 0,
  avgResponseTime: 0,
  lastHealthCheck: new Date(),
}

export function getConnectionStats() {
  return { ...connectionStats }
}

// Query optimization utilities
export class QueryOptimizer {
  private static queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  static async executeOptimizedQuery<T>(
    queryKey: string,
    queryFn: () => Promise<{ data: T | null; error: any }>,
    ttlMs: number = 300000 // 5 minutes default
  ): Promise<{ data: T | null; error: any; fromCache: boolean }> {
    const startTime = Date.now()

    // Check cache first
    const cached = this.queryCache.get(queryKey)
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return { data: cached.data, error: null, fromCache: true }
    }

    try {
      connectionStats.activeConnections++
      const result = await queryFn()

      // Cache successful results
      if (!result.error && result.data) {
        this.queryCache.set(queryKey, {
          data: result.data,
          timestamp: Date.now(),
          ttl: ttlMs
        })
      }

      // Update stats
      const responseTime = Date.now() - startTime
      connectionStats.totalQueries++
      connectionStats.avgResponseTime =
        (connectionStats.avgResponseTime * (connectionStats.totalQueries - 1) + responseTime) /
        connectionStats.totalQueries

      return { ...result, fromCache: false }
    } finally {
      connectionStats.activeConnections--
    }
  }

  static clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key)
        }
      }
    } else {
      this.queryCache.clear()
    }
  }

  static getCacheStats() {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys()),
    }
  }
}

// Database operation result types
export interface DatabaseResult<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface DatabaseListResult<T> {
  data: T[]
  error: string | null
  success: boolean
  count?: number
}

// Error handling utility
export function handleSupabaseError(error: any): string {
  if (!error) return 'Unknown database error'

  // Handle different types of Supabase errors
  if (error.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return 'A record with this information already exists'
      case '23503': // foreign_key_violation
        return 'Referenced record does not exist'
      case '23502': // not_null_violation
        return 'Required field is missing'
      case 'PGRST116': // Row Level Security violation
        return 'Access denied: insufficient permissions'
      default:
        return error.message || 'Database operation failed'
    }
  }

  return error.message || 'Database operation failed'
}

// Generic database operation wrapper
export async function executeQuery<T>(
  operation: () => Promise<{ data: T | null; error: any }>
): Promise<DatabaseResult<T>> {
  try {
    const { data, error } = await operation()

    if (error) {
      console.error('Database operation failed:', error)
      return {
        data: null,
        error: handleSupabaseError(error),
        success: false
      }
    }

    return {
      data,
      error: null,
      success: true
    }
  } catch (err) {
    console.error('Database operation exception:', err)
    return {
      data: null,
      error: 'Database operation failed',
      success: false
    }
  }
}

// Generic list operation wrapper
export async function executeListQuery<T>(
  operation: () => Promise<{ data: T[] | null; error: any; count?: number }>
): Promise<DatabaseListResult<T>> {
  try {
    const { data, error, count } = await operation()

    if (error) {
      console.error('Database list operation failed:', error)
      return {
        data: [],
        error: handleSupabaseError(error),
        success: false
      }
    }

    return {
      data: data || [],
      error: null,
      success: true,
      count
    }
  } catch (err) {
    console.error('Database list operation exception:', err)
    return {
      data: [],
      error: 'Database operation failed',
      success: false
    }
  }
}