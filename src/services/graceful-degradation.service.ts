import { RecommendationRequest, RecommendationResponse, Recommendation } from '@/types'
import { supabase } from '@/lib/supabase'

/**
 * Service for handling graceful degradation when external services fail
 */
export class GracefulDegradationService {
  /**
   * Get cached recommendations from previous successful requests
   */
  static async getCachedRecommendations(
    request: RecommendationRequest,
    userId?: string
  ): Promise<RecommendationResponse | null> {
    try {
      if (!userId) {
        return null
      }

      // Look for similar cached recommendations in user's taste history
      const { data: cachedResults, error } = await supabase
        .from('user_taste_history')
        .select('recommendations, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error || !cachedResults?.length) {
        return null
      }

      // Find the most relevant cached result based on input entities
      const inputEntityNames = request.entities.map(e => e.name.toLowerCase())
      let bestMatch: any = null
      let bestScore = 0

      for (const result of cachedResults) {
        const score = this.calculateRelevanceScore(
          inputEntityNames,
          result.recommendations
        )
        
        if (score > bestScore) {
          bestScore = score
          bestMatch = result
        }
      }

      if (bestMatch && bestScore > 0.3) { // Minimum relevance threshold
        return {
          success: true,
          input: request.entities,
          recommendations: bestMatch.recommendations,
          processingTime: 0,
          cached: true
        }
      }

      return null
    } catch (error) {
      console.error('[GracefulDegradation] Error getting cached recommendations:', error)
      return null
    }
  }

  /**
   * Get fallback recommendations based on popular items
   */
  static async getFallbackRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResponse> {
    try {
      // Get popular recommendations from recent successful requests
      const { data: popularItems, error } = await supabase
        .from('user_taste_history')
        .select('recommendations')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(50)

      if (error) {
        throw error
      }

      // Aggregate and rank popular recommendations
      const aggregatedRecs = this.aggregatePopularRecommendations(
        popularItems?.map(item => item.recommendations) || [],
        request.domains,
        request.limit || 5
      )

      return {
        success: true,
        input: request.entities,
        recommendations: aggregatedRecs,
        processingTime: 0,
        cached: true
      }
    } catch (error) {
      console.error('[GracefulDegradation] Error getting fallback recommendations:', error)
      
      // Return static fallback recommendations as last resort
      return this.getStaticFallbackRecommendations(request)
    }
  }

  /**
   * Get static fallback recommendations when all else fails
   */
  static getStaticFallbackRecommendations(
    request: RecommendationRequest
  ): RecommendationResponse {
    console.log('[GracefulDegradation] Using static fallback recommendations')
    
    const staticRecommendations: Record<string, Recommendation[]> = {
      movie: [
        {
          id: 'fallback-movie-1',
          name: 'The Shawshank Redemption',
          type: 'movie',
          confidence: 0.7,
          explanation: 'A highly acclaimed drama that appeals to diverse tastes.',
          metadata: { year: 1994, genre: 'Drama', fallback: true }
        },
        {
          id: 'fallback-movie-2',
          name: 'Inception',
          type: 'movie',
          confidence: 0.7,
          explanation: 'A mind-bending thriller with broad appeal.',
          metadata: { year: 2010, genre: 'Sci-Fi', fallback: true }
        }
      ],
      book: [
        {
          id: 'fallback-book-1',
          name: 'The Alchemist',
          type: 'book',
          confidence: 0.7,
          explanation: 'A philosophical novel with universal themes.',
          metadata: { author: 'Paulo Coelho', fallback: true }
        },
        {
          id: 'fallback-book-2',
          name: '1984',
          type: 'book',
          confidence: 0.7,
          explanation: 'A classic dystopian novel with enduring relevance.',
          metadata: { author: 'George Orwell', fallback: true }
        }
      ],
      song: [
        {
          id: 'fallback-song-1',
          name: 'Bohemian Rhapsody',
          type: 'song',
          confidence: 0.7,
          explanation: 'An iconic rock opera with universal appeal.',
          metadata: { artist: 'Queen', fallback: true }
        }
      ],
      artist: [
        {
          id: 'fallback-artist-1',
          name: 'The Beatles',
          type: 'artist',
          confidence: 0.8,
          explanation: 'Legendary band that influenced generations of musicians.',
          metadata: { genre: 'Rock', fallback: true }
        }
      ],
      restaurant: [
        {
          id: 'fallback-restaurant-1',
          name: 'Local Italian Bistro',
          type: 'restaurant',
          confidence: 0.6,
          explanation: 'Authentic Italian cuisine with cozy atmosphere.',
          metadata: { cuisine: 'Italian', fallback: true }
        }
      ],
      tv_show: [
        {
          id: 'fallback-tv-1',
          name: 'Breaking Bad',
          type: 'tv_show',
          confidence: 0.8,
          explanation: 'Critically acclaimed drama series.',
          metadata: { genre: 'Drama', fallback: true }
        }
      ],
      podcast: [
        {
          id: 'fallback-podcast-1',
          name: 'This American Life',
          type: 'podcast',
          confidence: 0.7,
          explanation: 'Award-winning storytelling podcast.',
          metadata: { category: 'Society & Culture', fallback: true }
        }
      ],
      game: [
        {
          id: 'fallback-game-1',
          name: 'The Legend of Zelda',
          type: 'game',
          confidence: 0.8,
          explanation: 'Open-world adventure game.',
          metadata: { platform: 'Nintendo Switch', fallback: true }
        }
      ],
      brand: [
        {
          id: 'fallback-brand-1',
          name: 'Apple',
          type: 'brand',
          confidence: 0.7,
          explanation: 'Innovative technology brand.',
          metadata: { category: 'Technology', fallback: true }
        }
      ]
    }

    // Filter recommendations based on requested domains
    const filteredRecommendations: Record<string, Recommendation[]> = {}
    const targetDomains = request.domains || Object.keys(staticRecommendations)
    const limit = request.limit || 5

    for (const domain of targetDomains) {
      if (staticRecommendations[domain]) {
        filteredRecommendations[domain] = staticRecommendations[domain].slice(0, limit)
      }
    }

    return {
      success: true,
      input: request.entities,
      recommendations: filteredRecommendations,
      processingTime: 0,
      cached: true
    }
  }

  /**
   * Calculate relevance score between input entities and cached recommendations
   */
  private static calculateRelevanceScore(
    inputEntityNames: string[],
    cachedRecommendations: Record<string, Recommendation[]>
  ): number {
    let totalScore = 0
    let totalItems = 0

    for (const domain of Object.keys(cachedRecommendations)) {
      for (const rec of cachedRecommendations[domain]) {
        totalItems++
        
        // Simple string similarity check
        for (const inputName of inputEntityNames) {
          if (rec.name.toLowerCase().includes(inputName) || 
              inputName.includes(rec.name.toLowerCase())) {
            totalScore += 0.8
          } else if (this.calculateStringSimilarity(inputName, rec.name.toLowerCase()) > 0.6) {
            totalScore += 0.4
          }
        }
      }
    }

    return totalItems > 0 ? totalScore / totalItems : 0
  }

  /**
   * Aggregate popular recommendations from recent history
   */
  private static aggregatePopularRecommendations(
    recentRecommendations: Record<string, Recommendation[]>[],
    requestedDomains?: string[],
    limit: number = 5
  ): Record<string, Recommendation[]> {
    const itemCounts: Record<string, { item: Recommendation; count: number }> = {}
    
    // Count occurrences of each recommendation
    for (const recSet of recentRecommendations) {
      for (const domain of Object.keys(recSet)) {
        if (requestedDomains && !requestedDomains.includes(domain)) {
          continue
        }
        
        for (const rec of recSet[domain]) {
          const key = `${domain}:${rec.name.toLowerCase()}`
          if (itemCounts[key]) {
            itemCounts[key].count++
          } else {
            itemCounts[key] = { item: rec, count: 1 }
          }
        }
      }
    }

    // Group by domain and sort by popularity
    const result: Record<string, Recommendation[]> = {}
    const domains = requestedDomains || [...new Set(Object.keys(itemCounts).map(key => key.split(':')[0]))]
    
    for (const domain of domains) {
      const domainItems = Object.entries(itemCounts)
        .filter(([key]) => key.startsWith(`${domain}:`))
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, limit)
        .map(([, { item }]) => ({
          ...item,
          explanation: `Popular choice based on recent user preferences. ${item.explanation}`,
          metadata: { ...item.metadata, popularity: true }
        }))
      
      if (domainItems.length > 0) {
        result[domain] = domainItems
      }
    }

    return result
  }

  /**
   * Simple string similarity calculation using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    
    if (len1 === 0) return len2 === 0 ? 1 : 0
    if (len2 === 0) return 0

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null))

    for (let i = 0; i <= len1; i++) matrix[0][i] = i
    for (let j = 0; j <= len2; j++) matrix[j][0] = j

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        )
      }
    }

    const maxLen = Math.max(len1, len2)
    return (maxLen - matrix[len2][len1]) / maxLen
  }

  /**
   * Check if external services are available
   */
  static async checkExternalServiceHealth(): Promise<{
    qloo: boolean
    gemini: boolean
    overall: boolean
  }> {
    const results = { qloo: false, gemini: false, overall: false }

    try {
      // Quick health check for Qloo
      if (process.env.QLOO_API_KEY) {
        const { createCachedQlooService } = await import('@/services/cached-qloo.service')
        const qlooService = createCachedQlooService()
        
        // Try to get cache stats as a lightweight check
        await qlooService.getCacheStats()
        results.qloo = true
      }
    } catch (error) {
      console.warn('[GracefulDegradation] Qloo service check failed:', error)
    }

    try {
      // Quick health check for Gemini
      if (process.env.GEMINI_API_KEY) {
        const { GeminiService } = await import('@/services/gemini.service')
        const geminiService = new GeminiService({
          apiKey: process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
        })
        
        // Just check if service can be instantiated
        geminiService.getModelInfo()
        results.gemini = true
      }
    } catch (error) {
      console.warn('[GracefulDegradation] Gemini service check failed:', error)
    }

    results.overall = results.qloo && results.gemini
    return results
  }
}