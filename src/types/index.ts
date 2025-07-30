// Core entity types
// Note: 'game' type temporarily removed from UI due to API access restrictions
export type EntityType = 'movie' | 'book' | 'song' | 'artist' | 'restaurant' | 'brand' | 'tv_show' | 'podcast' | 'game'

export interface Entity {
  id?: string
  name: string
  type: EntityType
  metadata?: Record<string, unknown>
}

// Recommendation types
export interface Recommendation {
  id: string
  name: string
  type: EntityType
  confidence: number
  explanation: string
  metadata: Record<string, unknown>
}

export interface RecommendationsByDomain {
  [domain: string]: Recommendation[]
}

// API Request/Response types
export interface RecommendationRequest {
  entities: Entity[]
  domains?: string[] // Optional filter for output domains
  limit?: number // Max recommendations per domain (default: 5)
  includeExplanations?: boolean // Default: true
  userId?: string // Optional user ID for personalization
  sessionId?: string // Optional session ID for tracking
}

export interface RecommendationResponse {
  success: boolean
  input: Entity[]
  recommendations: RecommendationsByDomain
  processingTime: number
  cached: boolean
  error?: string // Optional error message for failed requests
}

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    retryAfter?: number // For rate limiting
  }
  requestId: string
  timestamp: string
}

// Qloo API types
export interface QlooEntity {
  id: string
  name: string
  type: string
  metadata?: Record<string, unknown>
}

export interface QlooTag {
  tag_id: string
  name: string
  types: string[]
  subtype: string
  affinity: number
}

export interface QlooInsights {
  tags: QlooTag[]
}

export interface QlooRecommendation {
  id: string
  name: string
  type: string
  confidence: number
  metadata?: Record<string, unknown>
}

// Cultural theme types
export interface CulturalTheme {
  id: string
  name: string
  category: string
  affinity: number
  applicableDomains: string[]
}

export interface TasteProfile {
  inputEntities: Entity[]
  extractedThemes: CulturalTheme[]
  crossDomainMappings: Map<string, Entity[]>
}

// User and database types
export interface UserProfile {
  id: string
  clerk_user_id: string
  email: string
  display_name?: string
  tier: 'free' | 'premium' | 'enterprise'
  usage_limit: number
  created_at: string
  updated_at: string
}

export interface UserTasteHistory {
  id: string
  user_id: string
  input_entity: Entity
  recommendations: RecommendationsByDomain
  session_id?: string
  created_at: string
}

export interface ApiUsage {
  id: string
  user_id: string
  endpoint: string
  request_count: number
  response_time_ms?: number
  date: string
  created_at: string
}

export interface CachedExplanation {
  id: string
  input_entity_hash: string
  recommended_entity_hash: string
  explanation: string
  confidence_score?: number
  created_at: string
  expires_at: string
}

export interface SystemMetrics {
  id: string
  metric_name: string
  metric_value: number
  tags?: Record<string, unknown>
  timestamp: string
}

// Service configuration types
export interface RetryConfig {
  maxRetries: number
  backoffMultiplier: number
  initialDelay: number
  maxDelay: number
}

export interface ServiceConfig {
  qloo: RetryConfig
  gemini: RetryConfig
}

// Cache types
export interface CacheConfig {
  l1: {
    ttl: number // milliseconds
    maxSize: number
  }
  l2: {
    ttl: number // seconds
    keyPrefix: string
  }
  l3: {
    ttl: number // days
  }
}

export interface CacheKey {
  type: 'qloo_insights' | 'qloo_recommendations' | 'gemini_explanation'
  identifier: string
  params?: Record<string, unknown>
}

// Rate limiting types
export interface RateLimitConfig {
  free: {
    requests: number
    window: number // seconds
  }
  premium: {
    requests: number
    window: number
  }
  enterprise: {
    requests: number
    window: number
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}