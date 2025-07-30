import { ServiceConfig, CacheConfig, RateLimitConfig } from '@/types'

export const SERVICE_CONFIG: ServiceConfig = {
  qloo: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
    maxDelay: 10000
  },
  gemini: {
    maxRetries: 2,
    backoffMultiplier: 1.5,
    initialDelay: 500,
    maxDelay: 5000
  }
}

export const CACHE_CONFIG: CacheConfig = {
  l1: {
    ttl: 5 * 60 * 1000, // 5 minutes in milliseconds
    maxSize: 1000
  },
  l2: {
    ttl: 24 * 60 * 60, // 24 hours in seconds
    keyPrefix: 'cdre:'
  },
  l3: {
    ttl: 7 // 7 days
  }
}

export const RATE_LIMIT_CONFIG: RateLimitConfig = {
  free: {
    requests: 100,
    window: 24 * 60 * 60 // 24 hours
  },
  premium: {
    requests: 1000,
    window: 24 * 60 * 60 // 24 hours
  },
  enterprise: {
    requests: 10000,
    window: 24 * 60 * 60 // 24 hours
  }
}

export const API_ENDPOINTS = {
  qloo: {
    base: process.env.QLOO_API_URL || 'https://api.qloo.com/v1',
    insights: '/insights',
    search: '/search',
    recommendations: '/recommendations'
  },
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta',
    generateContent: '/models/gemini-pro:generateContent'
  }
}

export const SUPPORTED_DOMAINS = [
  'movies',
  'books', 
  'music',
  'restaurants',
  'tv_shows',
  'podcasts',
  'games',
  'brands'
] as const

export const DEFAULT_RECOMMENDATION_LIMIT = 5
export const MAX_RECOMMENDATION_LIMIT = 20
export const DEFAULT_CACHE_TTL = 24 * 60 * 60 // 24 hours in seconds