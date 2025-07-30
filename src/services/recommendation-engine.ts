import {
  Entity,
  Recommendation,
  RecommendationsByDomain,
  QlooTag,
  CulturalTheme,
  TasteProfile,
  QlooRecommendation,
  RecommendationRequest,
  RecommendationResponse
} from '@/types'
import { CachedQlooService } from './cached-qloo.service'
import { GeminiService, BatchExplanationRequest } from './gemini.service'

export interface RecommendationEngineConfig {
  qlooService: CachedQlooService
  geminiService: GeminiService
  defaultLimit?: number
  confidenceThreshold?: number
  maxCrossDomainResults?: number
}

export interface ProcessingMetrics {
  totalProcessingTime: number
  qlooApiCalls: number
  geminiApiCalls: number
  cacheHits: number
  cacheMisses: number
  entitiesProcessed: number
  recommendationsGenerated: number
}

/**
 * Core recommendation engine that orchestrates the recommendation flow
 * Implements requirements 1.1, 1.3, 1.5
 */
export class RecommendationEngine {
  private qlooService: CachedQlooService
  private geminiService: GeminiService
  private defaultLimit: number
  private confidenceThreshold: number
  private maxCrossDomainResults: number

  constructor(config: RecommendationEngineConfig) {
    this.qlooService = config.qlooService
    this.geminiService = config.geminiService
    this.defaultLimit = config.defaultLimit || 5
    this.confidenceThreshold = config.confidenceThreshold || 0.3
    this.maxCrossDomainResults = config.maxCrossDomainResults || 50
  }

  /**
   * Main entry point for generating cross-domain recommendations
   * Requirement 1.1: Generate cross-domain recommendations within 3 seconds
   */
  async generateRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const startTime = Date.now()
    const metrics: ProcessingMetrics = {
      totalProcessingTime: 0,
      qlooApiCalls: 0,
      geminiApiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      entitiesProcessed: request.entities.length,
      recommendationsGenerated: 0
    }

    try {
      // Step 1: Analyze taste profile from input entities
      console.log(`[RecommendationEngine] Analyzing taste profile for ${request.entities.length} entities`)
      const tasteProfile = await this.analyzeTasteProfile(request.entities, metrics)

      // Step 2: Generate cross-domain recommendations
      console.log(`[RecommendationEngine] Generating cross-domain recommendations`)
      const crossDomainRecommendations = await this.generateCrossDomainRecommendations(
        tasteProfile,
        request.domains,
        request.limit || this.defaultLimit,
        metrics
      )

      // Step 3: Generate explanations if requested
      let recommendationsByDomain: RecommendationsByDomain = {}
      if (request.includeExplanations !== false) {
        console.log(`[RecommendationEngine] Generating explanations`)
        recommendationsByDomain = await this.generateExplanations(
          request.entities,
          crossDomainRecommendations,
          metrics
        )
      } else {
        // Convert to recommendations without explanations
        recommendationsByDomain = this.convertToRecommendationsWithoutExplanations(crossDomainRecommendations)
      }

      // Step 4: Aggregate and rank results
      console.log(`[RecommendationEngine] Aggregating and ranking results`)
      const finalRecommendations = this.aggregateAndRankResults(
        recommendationsByDomain,
        request.limit || this.defaultLimit
      )

      metrics.totalProcessingTime = Date.now() - startTime
      metrics.recommendationsGenerated = Object.values(finalRecommendations)
        .reduce((total, recs) => total + recs.length, 0)

      console.log(`[RecommendationEngine] Generated ${metrics.recommendationsGenerated} recommendations in ${metrics.totalProcessingTime}ms`)

      return {
        success: true,
        input: request.entities,
        recommendations: finalRecommendations,
        processingTime: metrics.totalProcessingTime,
        cached: metrics.cacheHits > metrics.cacheMisses
      }
    } catch (error) {
      console.error('[RecommendationEngine] Error generating recommendations:', error)
      throw error
    }
  }

  /**
   * Analyze taste profile from input entities
   * Requirement 1.3: Extract cultural tags and themes
   */
  private async analyzeTasteProfile(entities: Entity[], metrics: ProcessingMetrics): Promise<TasteProfile> {
    const extractedThemes: CulturalTheme[] = []
    const crossDomainMappings = new Map<string, Entity[]>()

    for (const entity of entities) {
      try {
        // First, search for the entity if no ID is provided
        let entityId = entity.id
        if (!entityId) {
          console.log(`[RecommendationEngine] Searching for entity: ${entity.name} (${entity.type})`)
          const searchResults = await this.qlooService.searchEntity(entity.name, entity.type)
          metrics.qlooApiCalls++

          if (searchResults.length === 0) {
            console.warn(`[RecommendationEngine] Entity not found: ${entity.name}`)
            continue
          }

          entityId = searchResults[0].id
          entity.id = entityId // Update the entity with the found ID
        }

        // Get insights for the entity
        console.log(`[RecommendationEngine] Getting insights for entity: ${entityId} (${entity.type})`)
        const insights = await this.qlooService.getEntityInsights(entityId, entity.type)
        metrics.qlooApiCalls++

        // Convert Qloo tags to cultural themes
        const themes = this.convertTagsToThemes(insights.tags, entity.type)
        extractedThemes.push(...themes)

        console.log(`[RecommendationEngine] Extracted ${themes.length} themes from ${entity.name}`)
      } catch (error) {
        console.error(`[RecommendationEngine] Error analyzing entity ${entity.name}:`, error)
        // Continue with other entities even if one fails
      }
    }

    // Remove duplicate themes and merge similar ones
    const uniqueThemes = this.deduplicateThemes(extractedThemes)

    return {
      inputEntities: entities,
      extractedThemes: uniqueThemes,
      crossDomainMappings
    }
  }

  /**
   * Generate cross-domain recommendations using cultural themes
   * Requirement 1.5: Include at least 3 different domains in response
   */
  private async generateCrossDomainRecommendations(
    tasteProfile: TasteProfile,
    requestedDomains?: string[],
    limit: number = 5,
    metrics: ProcessingMetrics = {} as ProcessingMetrics
  ): Promise<Map<string, QlooRecommendation[]>> {
    const recommendations = new Map<string, QlooRecommendation[]>()

    // Define target domains (filtered to exclude restricted domains)
    // Note: 'game' domain often has restricted access, so we exclude it for better reliability
    const allDomains = ['movie', 'book', 'song', 'artist', 'restaurant', 'brand', 'tv_show', 'podcast']
    const targetDomains = requestedDomains && requestedDomains.length > 0
      ? requestedDomains.filter(domain => allDomains.includes(domain)) // Filter out restricted domains
      : allDomains.slice(0, Math.max(3, allDomains.length))

    // Convert cultural themes back to Qloo tags for API calls
    const qlooTags = this.convertThemesToTags(tasteProfile.extractedThemes)

    if (qlooTags.length === 0) {
      console.warn('[RecommendationEngine] No cultural themes found, cannot generate recommendations')
      return recommendations
    }

    try {
      // Get cross-domain recommendations from Qloo
      console.log(`[RecommendationEngine] Getting cross-domain recommendations for ${targetDomains.length} domains`)
      const crossDomainResults = await this.qlooService.getCrossDomainRecommendations(
        qlooTags,
        targetDomains,
        this.maxCrossDomainResults
      )
      metrics.qlooApiCalls++

      // Group recommendations by domain
      const groupedByDomain = this.groupRecommendationsByDomain(crossDomainResults)

      // Ensure we have at least 3 domains with recommendations
      const domainsWithResults = Object.keys(groupedByDomain)
      if (domainsWithResults.length < 3) {
        console.log(`[RecommendationEngine] Only ${domainsWithResults.length} domains found, trying individual entity recommendations`)

        // Try to get more recommendations using individual entities
        for (const entity of tasteProfile.inputEntities) {
          if (entity.id) {
            try {
              const entityRecs = await this.qlooService.getEntityRecommendations(
                entity.id,
                entity.type,
                targetDomains.filter(d => !domainsWithResults.includes(d)),
                limit
              )
              metrics.qlooApiCalls++

              const additionalGrouped = this.groupRecommendationsByDomain(entityRecs)

              // Merge with existing results
              for (const [domain, recs] of Object.entries(additionalGrouped)) {
                if (!groupedByDomain[domain]) {
                  groupedByDomain[domain] = []
                }
                groupedByDomain[domain].push(...recs)
              }
            } catch (error) {
              console.error(`[RecommendationEngine] Error getting entity recommendations for ${entity.name}:`, error)
            }
          }
        }
      }

      // Convert to Map and limit results per domain
      for (const [domain, recs] of Object.entries(groupedByDomain)) {
        const limitedRecs = recs
          .filter(rec => rec.confidence >= this.confidenceThreshold)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, limit)

        if (limitedRecs.length > 0) {
          recommendations.set(domain, limitedRecs)
        }
      }

      console.log(`[RecommendationEngine] Generated recommendations for ${recommendations.size} domains`)

    } catch (error) {
      console.error('[RecommendationEngine] Error generating cross-domain recommendations:', error)
      throw error
    }

    return recommendations
  }

  /**
   * Generate explanations for recommendations using Gemini
   * Requirement 2.1: Include conversational explanations
   */
  private async generateExplanations(
    inputEntities: Entity[],
    crossDomainRecommendations: Map<string, QlooRecommendation[]>,
    metrics: ProcessingMetrics
  ): Promise<RecommendationsByDomain> {
    const recommendationsByDomain: RecommendationsByDomain = {}

    // Prepare batch explanation requests for each input entity
    for (const inputEntity of inputEntities) {
      const allRecommendations: Array<{
        domain: string
        entity: Entity
        sharedThemes: QlooTag[]
        affinityScore: number
      }> = []

      // Collect all recommendations across domains
      for (const [domain, recs] of crossDomainRecommendations.entries()) {
        for (const rec of recs) {
          allRecommendations.push({
            domain,
            entity: {
              id: rec.id,
              name: rec.name,
              type: rec.type as any,
              metadata: rec.metadata
            },
            sharedThemes: [], // Will be populated with relevant themes
            affinityScore: rec.confidence
          })
        }
      }

      if (allRecommendations.length === 0) continue

      try {
        // Get shared themes for this input entity
        const inputThemes = await this.getEntityThemes(inputEntity)

        // Update recommendations with shared themes
        for (const rec of allRecommendations) {
          const recThemes = await this.getEntityThemes(rec.entity)
          rec.sharedThemes = this.findSharedThemes(inputThemes, recThemes)
        }

        // Generate batch explanations
        const batchRequest: BatchExplanationRequest = {
          inputEntity,
          recommendations: allRecommendations.map(rec => ({
            entity: rec.entity,
            sharedThemes: rec.sharedThemes,
            affinityScore: rec.affinityScore
          }))
        }

        console.log(`[RecommendationEngine] Generating ${allRecommendations.length} explanations for ${inputEntity.name}`)
        const batchResponse = await this.geminiService.generateBatchExplanations(batchRequest)
        metrics.geminiApiCalls++

        // Organize explanations by domain
        for (let i = 0; i < allRecommendations.length; i++) {
          const rec = allRecommendations[i]
          const explanation = batchResponse.explanations[i]

          if (!recommendationsByDomain[rec.domain]) {
            recommendationsByDomain[rec.domain] = []
          }

          recommendationsByDomain[rec.domain].push({
            id: rec.entity.id || rec.entity.name,
            name: rec.entity.name,
            type: rec.entity.type,
            confidence: rec.affinityScore,
            explanation: explanation.explanation,
            metadata: rec.entity.metadata || {}
          })
        }

      } catch (error) {
        console.error(`[RecommendationEngine] Error generating explanations for ${inputEntity.name}:`, error)

        // Fallback: create recommendations without explanations
        for (const [domain, recs] of crossDomainRecommendations.entries()) {
          if (!recommendationsByDomain[domain]) {
            recommendationsByDomain[domain] = []
          }

          for (const rec of recs) {
            recommendationsByDomain[domain].push({
              id: rec.id,
              name: rec.name,
              type: rec.type as any,
              confidence: rec.confidence,
              explanation: `Based on your interest in ${inputEntity.name}, you might enjoy ${rec.name} as well.`,
              metadata: rec.metadata || {}
            })
          }
        }
      }
    }

    return recommendationsByDomain
  }

  /**
   * Convert recommendations without explanations
   */
  private convertToRecommendationsWithoutExplanations(
    crossDomainRecommendations: Map<string, QlooRecommendation[]>
  ): RecommendationsByDomain {
    const recommendationsByDomain: RecommendationsByDomain = {}

    for (const [domain, recs] of crossDomainRecommendations.entries()) {
      recommendationsByDomain[domain] = recs.map(rec => ({
        id: rec.id,
        name: rec.name,
        type: rec.type as any,
        confidence: rec.confidence,
        explanation: '',
        metadata: rec.metadata || {}
      }))
    }

    return recommendationsByDomain
  }

  /**
   * Aggregate and rank final results
   * Ensures quality and diversity of recommendations
   */
  private aggregateAndRankResults(
    recommendationsByDomain: RecommendationsByDomain,
    limit: number
  ): RecommendationsByDomain {
    const finalResults: RecommendationsByDomain = {}

    for (const [domain, recommendations] of Object.entries(recommendationsByDomain)) {
      // Remove duplicates and sort by confidence
      const uniqueRecs = this.removeDuplicateRecommendations(recommendations)
      const sortedRecs = uniqueRecs
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit)

      if (sortedRecs.length > 0) {
        finalResults[domain] = sortedRecs
      }
    }

    return finalResults
  }

  // Helper methods

  /**
   * Convert Qloo tags to cultural themes
   */
  private convertTagsToThemes(tags: QlooTag[], entityType: string): CulturalTheme[] {
    return tags.map(tag => ({
      id: tag.tag_id,
      name: tag.name,
      category: tag.subtype || 'general',
      affinity: tag.affinity,
      applicableDomains: tag.types || [entityType]
    }))
  }

  /**
   * Convert cultural themes back to Qloo tags
   */
  private convertThemesToTags(themes: CulturalTheme[]): QlooTag[] {
    return themes.map(theme => ({
      tag_id: theme.id,
      name: theme.name,
      types: theme.applicableDomains,
      subtype: theme.category,
      affinity: theme.affinity
    }))
  }

  /**
   * Remove duplicate themes and merge similar ones
   */
  private deduplicateThemes(themes: CulturalTheme[]): CulturalTheme[] {
    const themeMap = new Map<string, CulturalTheme>()

    for (const theme of themes) {
      const key = theme.name.toLowerCase()

      if (themeMap.has(key)) {
        const existing = themeMap.get(key)!
        // Merge themes by taking the higher affinity and combining domains
        existing.affinity = Math.max(existing.affinity, theme.affinity)
        existing.applicableDomains = [...new Set([...existing.applicableDomains, ...theme.applicableDomains])]
      } else {
        themeMap.set(key, { ...theme })
      }
    }

    return Array.from(themeMap.values())
      .sort((a, b) => b.affinity - a.affinity) // Sort by affinity descending
  }

  /**
   * Group recommendations by domain/type
   */
  private groupRecommendationsByDomain(recommendations: QlooRecommendation[]): Record<string, QlooRecommendation[]> {
    const grouped: Record<string, QlooRecommendation[]> = {}

    for (const rec of recommendations) {
      const domain = rec.type
      if (!grouped[domain]) {
        grouped[domain] = []
      }
      grouped[domain].push(rec)
    }

    return grouped
  }

  /**
   * Remove duplicate recommendations within a domain
   */
  private removeDuplicateRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const seen = new Set<string>()
    const unique: Recommendation[] = []

    for (const rec of recommendations) {
      const key = `${rec.name.toLowerCase()}-${rec.type}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(rec)
      }
    }

    return unique
  }

  /**
   * Get themes for an entity (with caching)
   */
  private async getEntityThemes(entity: Entity): Promise<QlooTag[]> {
    if (!entity.id) return []

    // Skip entities with generated/fallback IDs that don't exist in Qloo
    if (entity.id.startsWith('rec-') || entity.id.startsWith('fallback-')) {
      console.log(`[RecommendationEngine] Skipping insights for generated entity ID: ${entity.id}`)
      return []
    }

    // Skip entities marked as fallback in metadata
    if (entity.metadata?.fallback === true) {
      console.log(`[RecommendationEngine] Skipping insights for fallback entity: ${entity.name}`)
      return []
    }

    try {
      const insights = await this.qlooService.getEntityInsights(entity.id, entity.type)
      return insights.tags
    } catch (error) {
      console.error(`[RecommendationEngine] Error getting themes for ${entity.name}:`, error)
      return []
    }
  }

  /**
   * Find shared themes between two sets of tags
   */
  private findSharedThemes(themes1: QlooTag[], themes2: QlooTag[]): QlooTag[] {
    const shared: QlooTag[] = []
    const theme2Map = new Map(themes2.map(t => [t.tag_id, t]))

    for (const theme1 of themes1) {
      const matching = theme2Map.get(theme1.tag_id)
      if (matching) {
        // Use the theme with higher affinity
        shared.push(theme1.affinity >= matching.affinity ? theme1 : matching)
      }
    }

    return shared.sort((a, b) => b.affinity - a.affinity)
  }

  /**
   * Get processing metrics for monitoring
   */
  getMetrics(): ProcessingMetrics {
    return {
      totalProcessingTime: 0,
      qlooApiCalls: 0,
      geminiApiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      entitiesProcessed: 0,
      recommendationsGenerated: 0
    }
  }

  /**
   * Health check for the recommendation engine
   */
  async healthCheck(): Promise<{ healthy: boolean; services: Record<string, boolean> }> {
    const services: Record<string, boolean> = {}

    try {
      // Check Qloo service
      const qlooHealth = await this.qlooService.getCacheStats()
      services.qloo = true
    } catch (error) {
      services.qloo = false
    }

    try {
      // Check Gemini service
      const geminiInfo = this.geminiService.getModelInfo()
      services.gemini = true
    } catch (error) {
      services.gemini = false
    }

    const healthy = Object.values(services).every(status => status)

    return { healthy, services }
  }

  /**
   * Apply personalization to recommendations based on user preferences
   */
  async personalizeRecommendations(
    recommendations: RecommendationsByDomain,
    userId?: string
  ): Promise<{ recommendations: RecommendationsByDomain; personalized: boolean }> {
    if (!userId) {
      return { recommendations, personalized: false }
    }

    try {
      // Get all recommendations as a flat array
      const allRecommendations = Object.values(recommendations).flat()

      // Apply personalization
      const { PersonalizationService } = await import('./personalization.service')
      const personalizedRecs = await PersonalizationService.personalizeRecommendations(
        userId,
        allRecommendations
      )

      // Group back by domain
      const personalizedByDomain: RecommendationsByDomain = {}

      for (const rec of personalizedRecs) {
        const domain = rec.type || 'unknown'
        if (!personalizedByDomain[domain]) {
          personalizedByDomain[domain] = []
        }
        personalizedByDomain[domain].push(rec)
      }

      return { recommendations: personalizedByDomain, personalized: true }
    } catch (error) {
      console.error('Error personalizing recommendations:', error)
      return { recommendations, personalized: false }
    }
  }

  /**
   * Enhanced recommendation generation with personalization
   */
  async generatePersonalizedRecommendations(request: RecommendationRequest & { personalize?: boolean }): Promise<RecommendationResponse & { personalized?: boolean }> {
    const startTime = Date.now()

    try {
      // Generate base recommendations
      const baseResponse = await this.generateRecommendations(request)

      if (!baseResponse.success || !request.userId || request.personalize === false) {
        return baseResponse
      }

      // Apply personalization
      const { recommendations: personalizedRecs, personalized } = await this.personalizeRecommendations(
        baseResponse.recommendations,
        request.userId
      )

      // Learn from this interaction for future personalization
      if (request.userId && personalizedRecs) {
        try {
          const { PersonalizationService } = await import('./personalization.service')
          await PersonalizationService.schedulePreferenceLearning(request.userId)
        } catch (error) {
          console.error('Error scheduling preference learning:', error)
        }
      }

      return {
        ...baseResponse,
        recommendations: personalizedRecs,
        personalized,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('Error generating personalized recommendations:', error)
      return {
        success: false,
        input: request.entities,
        recommendations: {},
        processingTime: Date.now() - startTime,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

/**
 * Factory function to create RecommendationEngine with default configuration
 */
export function createRecommendationEngine(
  qlooService: CachedQlooService,
  geminiService: GeminiService,
  options?: {
    defaultLimit?: number
    confidenceThreshold?: number
    maxCrossDomainResults?: number
  }
): RecommendationEngine {
  return new RecommendationEngine({
    qlooService,
    geminiService,
    defaultLimit: options?.defaultLimit || 5,
    confidenceThreshold: options?.confidenceThreshold || 0.3,
    maxCrossDomainResults: options?.maxCrossDomainResults || 50
  })
}

/**
 * Default recommendation engine instance (only if services are available)
 */
export const recommendationEngine = (() => {
  try {
    // Import services dynamically to avoid circular dependencies
    const { createCachedQlooService } = require('./cached-qloo.service')
    const { GeminiService } = require('./gemini.service')

    if (!process.env.QLOO_API_KEY || !process.env.GEMINI_API_KEY) {
      console.warn('[RecommendationEngine] API keys not found, recommendation engine not initialized')
      return null
    }

    const qlooService = createCachedQlooService()
    const geminiService = new GeminiService({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL
    })

    return createRecommendationEngine(qlooService, geminiService)
  } catch (error) {
    console.error('[RecommendationEngine] Failed to create default instance:', error)
    return null
  }
})()

export default RecommendationEngine