export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          clerk_user_id: string
          email: string
          display_name: string | null
          tier: string
          usage_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          email: string
          display_name?: string | null
          tier?: string
          usage_limit?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          email?: string
          display_name?: string | null
          tier?: string
          usage_limit?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_taste_history: {
        Row: {
          id: string
          user_id: string
          input_entity: any // JSONB
          recommendations: any // JSONB
          session_id: string | null
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          input_entity: any
          recommendations: any
          session_id?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          input_entity?: any
          recommendations?: any
          session_id?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
      }
      api_usage: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          request_count: number
          response_time_ms: number | null
          status_code: number | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          request_count?: number
          response_time_ms?: number | null
          status_code?: number | null
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          request_count?: number
          response_time_ms?: number | null
          status_code?: number | null
          date?: string
          created_at?: string
        }
      }
      cached_explanations: {
        Row: {
          id: string
          input_entity_hash: string
          recommended_entity_hash: string
          explanation: string
          confidence_score: number | null
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          input_entity_hash: string
          recommended_entity_hash: string
          explanation: string
          confidence_score?: number | null
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          input_entity_hash?: string
          recommended_entity_hash?: string
          explanation?: string
          confidence_score?: number | null
          created_at?: string
          expires_at?: string
        }
      }
      system_metrics: {
        Row: {
          id: string
          metric_name: string
          metric_value: number
          tags: any | null // JSONB
          timestamp: string
        }
        Insert: {
          id?: string
          metric_name: string
          metric_value: number
          tags?: any | null
          timestamp?: string
        }
        Update: {
          id?: string
          metric_name?: string
          metric_value?: number
          tags?: any | null
          timestamp?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_profile_by_clerk_id: {
        Args: {
          clerk_id: string
        }
        Returns: Database['public']['Tables']['user_profiles']['Row'] | null
      }
      get_or_create_user_profile: {
        Args: {
          clerk_id: string
          user_email: string
          user_display_name?: string | null
        }
        Returns: Database['public']['Tables']['user_profiles']['Row']
      }
      check_user_usage_limit: {
        Args: {
          clerk_id: string
          current_date?: string
        }
        Returns: boolean
      }
      cleanup_expired_explanations: {
        Args: {}
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Type helpers for easier usage
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

export type UserTasteHistory = Database['public']['Tables']['user_taste_history']['Row']
export type UserTasteHistoryInsert = Database['public']['Tables']['user_taste_history']['Insert']
export type UserTasteHistoryUpdate = Database['public']['Tables']['user_taste_history']['Update']

export type ApiUsage = Database['public']['Tables']['api_usage']['Row']
export type ApiUsageInsert = Database['public']['Tables']['api_usage']['Insert']
export type ApiUsageUpdate = Database['public']['Tables']['api_usage']['Update']

export type CachedExplanation = Database['public']['Tables']['cached_explanations']['Row']
export type CachedExplanationInsert = Database['public']['Tables']['cached_explanations']['Insert']
export type CachedExplanationUpdate = Database['public']['Tables']['cached_explanations']['Update']

export type SystemMetric = Database['public']['Tables']['system_metrics']['Row']
export type SystemMetricInsert = Database['public']['Tables']['system_metrics']['Insert']
export type SystemMetricUpdate = Database['public']['Tables']['system_metrics']['Update']