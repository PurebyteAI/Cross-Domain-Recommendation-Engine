import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { QlooService } from '@/services/qloo.service'
import { GeminiService } from '@/services/gemini.service'
import { RecommendationEngine } from '@/services/recommendation-engine'
import { createCachedQlooService } from '@/services/cached-qloo.service'
import { RecommendationRequest } from '@/types'

// These tests run against real APIs in sandbox/test mode
// They are skipped by default and only run when INTEGRATION_TEST=true
const SKIP_REAL_API_TESTS = process.env.INTEGRATION_TEST !== 'true'

describe('Real API Integration Tests', () => {
  let qlooService: QlooService
  let geminiService: GeminiService
  let recommendationEngine: RecommendationEngine

  beforeAll(async () => {
    if (SKIP_REAL_API_TESTS) {
      console.log('Skipping real API tests. Set INTEGRATION_TEST=true to run.')
      return
    }

    // Verify API keys are available
    if (!process.env.QLOO_API_KEY || !process.env.GEMINI_API_KEY) {
      throw new Error('API keys required for integration tests. Set QLOO_API_KEY and GEMINI_API_KEY environment variables.')
    }

    // Initialize services with real API keys
    const cachedQlooService = createCachedQlooService()
    qlooService = (cachedQlooService as any).qlooService // Access underlying service

    geminiService = new GeminiService({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    })

    recommendationEngine = new RecommendationEngine({
      qlooService: cachedQlooService,
      geminiService,
      defaultLimit: 3,
      confidenceThreshold: 0.3,
      maxCrossDomainResults: 30
    })

    console.log('Real API integration tests initialized')
  })

  describe('Qloo API Integration', () => {
    it.skipIf(SKIP_REAL_API_TESTS)('should search for entities successfully', async () => {
      const searchResults = await qlooService.searchEntity('The Beatles', 'artist')
      
      expect(searchResults).toBeDefined()
      expect(Array.isArray(searchResults)).toBe(true)
      expect(searchResults.length).toBeGreaterThan(0)
      
      const beatles = searchResults[0]
      expect(beatles.id).toBeDefined()
      expect(beatles.name.toLowerCase()).toContain('beatles')
      expect(beatles.type).toBe('artist')
    }, 10000)

    it.skipIf(SKIP_REAL_API_TESTS)('should get entity insights successfully', async () => {
      // First search for an entity
      const searchResults = await qlooService.searchEntity('Radiohead', 'artist')
      expect(searchResults.length).toBeGreaterThan(0)
      
      const entityId = searchResults[0].id
      const insights = await qlooService.getEntityInsights(entityId, 'artist')
      
      expect(insights).toBeDefined()
      expect(insights.tags).toBeDefined()
      expect(Array.isArray(insights.tags)).toBe(true)
      expect(insights.tags.length).toBeGreaterThan(0)
      
      // Check tag structure
      const tag = insights.tags[0]
      expect(tag.tag_id).toBeDefined()
      expect(tag.name).toBeDefined()
      expect(tag.affinity).toBeGreaterThan(0)
      expect(tag.affinity).toBeLessThanOrEqual(1)
    }, 10000)

    it.skipIf(SKIP_REAL_API_TESTS)('should get cross-domain recommendations', async () => {
      // Get insights for a known entity first
      const searchResults = await qlooService.searchEntity('Marvel', 'brand')
      expect(searchResults.length).toBeGreaterThan(0)
      
      const entityId = searchResults[0].id
      const insights = await qlooService.getEntityInsights(entityId, 'brand')
      
      // Use the tags to get cross-domain recommendations
      const recommendations = await qlooService.getCrossDomainRecommendations(
        insights.tags.slice(0, 5), // Use top 5 tags
        ['movie', 'book', 'tv_show'],
        20
      )
      
      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
      
      // Check recommendation structure
      const rec = recommendations[0]
      expect(rec.id).toBeDefined()
      expect(rec.name).toBeDefined()
      expect(rec.type).toBeDefined()
      expect(rec.confidence).toBeGreaterThan(0)
      expect(rec.confidence).toBeLessThanOrEqual(1)
    }, 15000)

    it.skipIf(SKIP_REAL_API_TESTS)('should handle entity not found gracefully', async () => {
      const searchResults = await qlooService.searchEntity('NonExistentEntity12345XYZ', 'movie')
      
      expect(searchResults).toBeDefined()
      expect(Array.isArray(searchResults)).toBe(true)
      expect(searchResults.length).toBe(0)
    }, 5000)
  })

  describe('Gemini API Integration', () => {
    it.skipIf(SKIP_REAL_API_TESTS)('should generate explanations successfully', async () => {
      const batchRequest = {
        inputEntity: { name: 'The Beatles', type: 'artist' as const },
        recommendations: [
          {
            entity: { name: 'Abbey Road Studios', type: 'brand' as const },
            sharedThemes: [
              { tag_id: 'rock', name: 'Rock Music', types: ['artist'], subtype: 'genre', affinity: 0.9 }
            ],
            affinityScore: 0.85
          },
          {
            entity: { name: 'Yellow Submarine', type: 'movie' as const },
            sharedThemes: [
              { tag_id: 'psychedelic', name: 'Psychedelic', types: ['artist', 'movie'], subtype: 'style', affinity: 0.8 }
            ],
            affinityScore: 0.75
          }
        ]
      }

      const response = await geminiService.generateBatchExplanations(batchRequest)
      
      expect(response).toBeDefined()
      expect(response.explanations).toBeDefined()
      expect(Array.isArray(response.explanations)).toBe(true)
      expect(response.explanations.length).toBe(2)
      
      // Check explanation structure
      for (const explanation of response.explanations) {
        expect(explanation.explanation).toBeDefined()
        expect(explanation.explanation.length).toBeGreaterThan(10)
        expect(explanation.confidence).toBeGreaterThan(0)
        expect(explanation.confidence).toBeLessThanOrEqual(1)
        
        // Should mention The Beatles
        expect(explanation.explanation.toLowerCase()).toContain('beatles')
      }
    }, 15000)

    it.skipIf(SKIP_REAL_API_TESTS)('should handle content filtering appropriately', async () => {
      const batchRequest = {
        inputEntity: { name: 'Test Entity', type: 'brand' as const },
        recommendations: [
          {
            entity: { name: 'Safe Content', type: 'brand' as const },
            sharedThemes: [
              { tag_id: 'family-friendly', name: 'Family Friendly', types: ['brand'], subtype: 'content', affinity: 0.9 }
            ],
            affinityScore: 0.8
          }
        ]
      }

      const response = await geminiService.generateBatchExplanations(batchRequest)
      
      expect(response).toBeDefined()
      expect(response.explanations.length).toBe(1)
      expect(response.explanations[0].explanation).toBeDefined()
      
      // Should not contain inappropriate content
      const explanation = response.explanations[0].explanation.toLowerCase()
      expect(explanation).not.toContain('inappropriate')
      expect(explanation).not.toContain('offensive')
    }, 10000)
  })

  describe('End-to-End Real API Flow', () => {
    it.skipIf(SKIP_REAL_API_TESTS)('should complete full recommendation flow with real APIs', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Christopher Nolan', type: 'artist' }
        ],
        limit: 3,
        includeExplanations: true
      }

      const startTime = Date.now()
      const response = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(response.success).toBe(true)
      expect(response.input).toEqual(request.entities)
      expect(response.processingTime).toBeGreaterThan(0)
      expect(totalTime).toBeLessThan(15000) // Should complete within 15 seconds

      // Should have found the entity ID
      expect(response.input[0].id).toBeDefined()

      // Should have recommendations
      const domains = Object.keys(response.recommendations)
      expect(domains.length).toBeGreaterThan(0)

      // Check recommendation quality
      for (const domain of domains) {
        const recs = response.recommendations[domain]
        expect(recs.length).toBeGreaterThan(0)
        expect(recs.length).toBeLessThanOrEqual(3)

        for (const rec of recs) {
          expect(rec.id).toBeDefined()
          expect(rec.name).toBeDefined()
          expect(rec.type).toBeDefined()
          expect(rec.confidence).toBeGreaterThan(0)
          expect(rec.confidence).toBeLessThanOrEqual(1)
          expect(rec.explanation).toBeDefined()
          expect(rec.explanation.length).toBeGreaterThan(10)
          
          // Explanation should mention Christopher Nolan
          expect(rec.explanation.toLowerCase()).toContain('nolan')
        }
      }

      console.log('Real API test completed:', {
        processingTime: response.processingTime,
        domains: domains.length,
        totalRecommendations: Object.values(response.recommendations).reduce((sum, recs) => sum + recs.length, 0)
      })
    }, 20000)

    it.skipIf(SKIP_REAL_API_TESTS)('should handle multiple entities with real APIs', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Disney', type: 'brand' },
          { name: 'Pixar', type: 'brand' }
        ],
        domains: ['movie', 'tv_show'],
        limit: 2,
        includeExplanations: true
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)
      expect(response.input.length).toBe(2)

      // Both entities should have IDs found
      expect(response.input[0].id).toBeDefined()
      expect(response.input[1].id).toBeDefined()

      // Should have recommendations in requested domains
      const domains = Object.keys(response.recommendations)
      for (const domain of domains) {
        expect(['movie', 'tv_show']).toContain(domain)
      }
    }, 25000)

    it.skipIf(SKIP_REAL_API_TESTS)('should demonstrate cross-domain connections', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Wes Anderson', type: 'artist' }
        ],
        limit: 2,
        includeExplanations: true
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)

      // Should have recommendations across different domains
      const domains = Object.keys(response.recommendations)
      expect(domains.length).toBeGreaterThan(1) // Multiple domains

      // Check for meaningful cross-domain connections
      let foundCrossDomainConnection = false
      for (const domain of domains) {
        if (domain !== 'movie' && domain !== 'artist') { // Wes Anderson is primarily movies/artist
          foundCrossDomainConnection = true
          break
        }
      }

      expect(foundCrossDomainConnection).toBe(true)

      // Explanations should show cultural connections
      for (const domain of domains) {
        const recs = response.recommendations[domain]
        for (const rec of recs) {
          const explanation = rec.explanation.toLowerCase()
          // Should mention aesthetic, style, or cultural themes
          const hasCulturalConnection = 
            explanation.includes('aesthetic') ||
            explanation.includes('style') ||
            explanation.includes('visual') ||
            explanation.includes('artistic') ||
            explanation.includes('whimsical') ||
            explanation.includes('symmetr')

          expect(hasCulturalConnection).toBe(true)
        }
      }
    }, 20000)
  })

  describe('API Error Handling', () => {
    it.skipIf(SKIP_REAL_API_TESTS)('should handle API rate limits gracefully', async () => {
      // Make multiple rapid requests to potentially trigger rate limiting
      const requests = Array(5).fill(null).map(() => ({
        entities: [{ name: 'Netflix', type: 'brand' as const }],
        limit: 1,
        includeExplanations: false
      }))

      const promises = requests.map(req => 
        recommendationEngine.generateRecommendations(req)
      )

      const responses = await Promise.allSettled(promises)

      // At least some requests should succeed
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.success)
      expect(successful.length).toBeGreaterThan(0)

      // Failed requests should have meaningful error handling
      const failed = responses.filter(r => r.status === 'rejected')
      for (const failure of failed) {
        expect(failure.reason).toBeInstanceOf(Error)
      }
    }, 30000)

    it.skipIf(SKIP_REAL_API_TESTS)('should handle network timeouts appropriately', async () => {
      // Test with a complex request that might timeout
      const request: RecommendationRequest = {
        entities: [
          { name: 'Marvel Cinematic Universe', type: 'brand' },
          { name: 'DC Extended Universe', type: 'brand' },
          { name: 'Star Wars', type: 'brand' }
        ],
        limit: 5,
        includeExplanations: true
      }

      const startTime = Date.now()
      
      try {
        const response = await recommendationEngine.generateRecommendations(request)
        const endTime = Date.now()
        const totalTime = endTime - startTime

        if (response.success) {
          expect(totalTime).toBeLessThan(30000) // Should not take more than 30 seconds
          expect(response.recommendations).toBeDefined()
        }
      } catch (error) {
        const endTime = Date.now()
        const totalTime = endTime - startTime
        
        // Even timeouts should not take excessively long
        expect(totalTime).toBeLessThan(35000)
        expect(error).toBeInstanceOf(Error)
      }
    }, 40000)
  })

  describe('Data Quality Validation', () => {
    it.skipIf(SKIP_REAL_API_TESTS)('should return high-quality recommendations', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Quentin Tarantino', type: 'artist' }
        ],
        limit: 3,
        includeExplanations: true
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)

      // Validate recommendation quality
      for (const domain of Object.keys(response.recommendations)) {
        const recs = response.recommendations[domain]
        
        for (const rec of recs) {
          // Should have reasonable confidence scores
          expect(rec.confidence).toBeGreaterThan(0.2) // At least 20% confidence
          
          // Names should not be empty or just whitespace
          expect(rec.name.trim().length).toBeGreaterThan(0)
          
          // Explanations should be substantial and relevant
          expect(rec.explanation.length).toBeGreaterThan(20)
          expect(rec.explanation.toLowerCase()).toContain('tarantino')
          
          // Should not contain placeholder text
          expect(rec.explanation).not.toContain('[')
          expect(rec.explanation).not.toContain('TODO')
          expect(rec.explanation).not.toContain('placeholder')
        }
      }
    }, 15000)
  })
})