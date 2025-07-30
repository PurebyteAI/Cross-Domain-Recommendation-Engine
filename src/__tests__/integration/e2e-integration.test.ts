import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as recommendationsPost, GET as recommendationsGet } from '@/app/api/v1/recommendations/route'
import { RecommendationEngine } from '@/services/recommendation-engine'
import { createCachedQlooService } from '@/services/cached-qloo.service'
import { GeminiService } from '@/services/gemini.service'
import { RecommendationRequest, RecommendationResponse, EntityType } from '@/types'

// Mock Clerk auth for testing
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: 'test-user-123' }))
}))

// Mock user profile service
vi.mock('@/services/user-profile.service', () => ({
  UserProfileService: {
    getProfileByClerkId: vi.fn(() => Promise.resolve({
      id: 'profile-123',
      clerk_user_id: 'test-user-123',
      email: 'test@example.com',
      tier: 'premium',
      usage_limit: 1000
    })),
    checkUsageLimit: vi.fn(() => Promise.resolve(true))
  }
}))

// Mock usage tracking service
vi.mock('@/services/usage-tracking.service', () => ({
  UsageTrackingService: {
    trackRequest: vi.fn(() => Promise.resolve())
  }
}))

describe('End-to-End Integration Tests', () => {
  let recommendationEngine: RecommendationEngine
  let qlooService: any
  let geminiService: GeminiService

  beforeAll(async () => {
    // Set up test environment variables
    process.env.QLOO_API_KEY = process.env.QLOO_API_KEY || 'test-qloo-key'
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key'
    process.env.GEMINI_MODEL = 'gemini-1.5-flash'

    // Initialize services for testing
    qlooService = createCachedQlooService()
    geminiService = new GeminiService({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    })

    recommendationEngine = new RecommendationEngine({
      qlooService,
      geminiService,
      defaultLimit: 5,
      confidenceThreshold: 0.3,
      maxCrossDomainResults: 50
    })
  })

  afterAll(async () => {
    // Clean up any resources
  })

  describe('Complete Recommendation Flow', () => {
    it('should generate cross-domain recommendations for a single entity', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Radiohead', type: 'artist' }
        ],
        limit: 3,
        includeExplanations: true
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)
      expect(response.input).toEqual(request.entities)
      expect(response.processingTime).toBeGreaterThan(0)
      expect(response.processingTime).toBeLessThan(10000) // Should complete within 10 seconds

      // Should have recommendations in multiple domains
      const domains = Object.keys(response.recommendations)
      expect(domains.length).toBeGreaterThanOrEqual(1) // At least one domain

      // Each domain should have recommendations
      for (const domain of domains) {
        const recs = response.recommendations[domain]
        expect(recs).toBeDefined()
        expect(recs.length).toBeGreaterThan(0)
        expect(recs.length).toBeLessThanOrEqual(3)

        // Each recommendation should have required fields
        for (const rec of recs) {
          expect(rec.id).toBeDefined()
          expect(rec.name).toBeDefined()
          expect(rec.type).toBeDefined()
          expect(rec.confidence).toBeGreaterThan(0)
          expect(rec.confidence).toBeLessThanOrEqual(1)
          expect(rec.explanation).toBeDefined()
          expect(rec.explanation.length).toBeGreaterThan(0)
          expect(rec.metadata).toBeDefined()
        }
      }
    }, 15000) // 15 second timeout for API calls

    it('should generate recommendations for multiple entities', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Inception', type: 'movie' },
          { name: 'The Dark Knight', type: 'movie' }
        ],
        domains: ['book', 'song', 'restaurant'],
        limit: 2,
        includeExplanations: true
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)
      expect(response.input).toEqual(request.entities)

      // Should only include requested domains
      const domains = Object.keys(response.recommendations)
      for (const domain of domains) {
        expect(request.domains).toContain(domain)
      }

      // Should respect limit
      for (const domain of domains) {
        const recs = response.recommendations[domain]
        expect(recs.length).toBeLessThanOrEqual(2)
      }
    }, 15000)

    it('should handle recommendations without explanations', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'The Beatles', type: 'artist' }
        ],
        limit: 2,
        includeExplanations: false
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)

      // Explanations should be empty or generic
      const domains = Object.keys(response.recommendations)
      for (const domain of domains) {
        const recs = response.recommendations[domain]
        for (const rec of recs) {
          expect(rec.explanation).toBeDefined()
          // Should be empty string when explanations are disabled
          expect(rec.explanation).toBe('')
        }
      }
    }, 10000)

    it('should handle entity search when no ID is provided', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Stranger Things', type: 'tv_show' }
        ],
        limit: 2
      }

      const response = await recommendationEngine.generateRecommendations(request)

      expect(response.success).toBe(true)
      expect(response.input[0].id).toBeDefined() // Should have found and set the ID
    }, 10000)
  })

  describe('API Endpoint Integration', () => {
    it('should handle POST /api/v1/recommendations with valid request', async () => {
      const requestBody = {
        entities: [
          { name: 'Pulp Fiction', type: 'movie' }
        ],
        limit: 2,
        includeExplanations: true
      }

      const request = new NextRequest('http://localhost:3000/api/v1/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const response = await recommendationsPost(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.recommendations).toBeDefined()
      expect(data.processingTime).toBeGreaterThan(0)
    }, 15000)

    it('should handle invalid request format', async () => {
      const requestBody = {
        entities: [], // Empty entities array should fail validation
        limit: 2
      }

      const request = new NextRequest('http://localhost:3000/api/v1/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const response = await recommendationsPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json'
      })

      const response = await recommendationsPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Performance Requirements', () => {
    it('should complete recommendations within 5 seconds for single entity', async () => {
      const startTime = Date.now()

      const request: RecommendationRequest = {
        entities: [
          { name: 'Taylor Swift', type: 'artist' }
        ],
        limit: 3
      }

      const response = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(response.success).toBe(true)
      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(response.processingTime).toBeLessThan(5000)
    }, 6000)

    it('should handle concurrent requests efficiently', async () => {
      const requests = [
        { entities: [{ name: 'The Godfather', type: 'movie' }], limit: 2 },
        { entities: [{ name: 'Pink Floyd', type: 'artist' }], limit: 2 },
        { entities: [{ name: '1984', type: 'book' }], limit: 2 }
      ]

      const startTime = Date.now()

      // Execute requests concurrently
      const promises = requests.map(req => 
        recommendationEngine.generateRecommendations(req)
      )

      const responses = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      // All requests should succeed
      for (const response of responses) {
        expect(response.success).toBe(true)
      }

      // Concurrent execution should be faster than sequential
      expect(totalTime).toBeLessThan(15000) // Should complete within 15 seconds
    }, 20000)
  })

  describe('Error Handling and Recovery', () => {
    it('should handle entity not found gracefully', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'NonExistentEntity12345', type: 'movie' }
        ],
        limit: 2
      }

      // Should not throw an error, but may return empty results
      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)
      // May have empty recommendations, which is acceptable
    }, 10000)

    it('should handle mixed valid and invalid entities', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'The Matrix', type: 'movie' }, // Valid
          { name: 'InvalidEntity999', type: 'book' } // Invalid
        ],
        limit: 2
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)
      // Should still return recommendations for valid entities
    }, 10000)

    it('should handle service degradation gracefully', async () => {
      // Test with a request that might trigger service issues
      const request: RecommendationRequest = {
        entities: [
          { name: 'Test Entity', type: 'game' } // Game domain might have access issues
        ],
        limit: 1
      }

      // Should not throw unhandled errors
      try {
        const response = await recommendationEngine.generateRecommendations(request)
        expect(response.success).toBe(true)
      } catch (error) {
        // If it fails, it should be a handled error
        expect(error).toBeInstanceOf(Error)
      }
    }, 10000)
  })

  describe('Caching Behavior', () => {
    it('should cache and reuse results for identical requests', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Breaking Bad', type: 'tv_show' }
        ],
        limit: 2
      }

      // First request
      const response1 = await recommendationEngine.generateRecommendations(request)
      expect(response1.success).toBe(true)

      // Second identical request (should be faster due to caching)
      const startTime = Date.now()
      const response2 = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()

      expect(response2.success).toBe(true)
      // Second request should be faster (though this might not always be reliable)
      expect(endTime - startTime).toBeLessThan(response1.processingTime)
    }, 15000)
  })

  describe('Data Quality and Validation', () => {
    it('should return valid entity types in recommendations', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Spotify', type: 'brand' }
        ],
        limit: 3
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)

      const validTypes: EntityType[] = [
        'movie', 'book', 'song', 'artist', 'restaurant', 'brand', 'tv_show', 'podcast', 'game'
      ]

      for (const domain of Object.keys(response.recommendations)) {
        const recs = response.recommendations[domain]
        for (const rec of recs) {
          expect(validTypes).toContain(rec.type as EntityType)
        }
      }
    }, 10000)

    it('should return reasonable confidence scores', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Netflix', type: 'brand' }
        ],
        limit: 3
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)

      for (const domain of Object.keys(response.recommendations)) {
        const recs = response.recommendations[domain]
        for (const rec of recs) {
          expect(rec.confidence).toBeGreaterThan(0)
          expect(rec.confidence).toBeLessThanOrEqual(1)
          expect(typeof rec.confidence).toBe('number')
          expect(isNaN(rec.confidence)).toBe(false)
        }
      }
    }, 10000)

    it('should generate meaningful explanations', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Wes Anderson', type: 'artist' }
        ],
        limit: 2,
        includeExplanations: true
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)

      for (const domain of Object.keys(response.recommendations)) {
        const recs = response.recommendations[domain]
        for (const rec of recs) {
          expect(rec.explanation).toBeDefined()
          expect(rec.explanation.length).toBeGreaterThan(10) // Should be substantial
          expect(rec.explanation).toMatch(/\w+/) // Should contain words
          // Should not be just a generic template
          expect(rec.explanation.toLowerCase()).toContain('wes anderson')
        }
      }
    }, 15000)
  })

  describe('API Documentation Endpoint', () => {
    it('should return API documentation via GET request', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/recommendations', {
        method: 'GET'
      })

      const response = await recommendationsGet()
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.name).toBeDefined()
      expect(data.version).toBeDefined()
      expect(data.description).toBeDefined()
      expect(data.endpoints).toBeDefined()
      expect(data.supportedEntityTypes).toBeDefined()
      expect(data.supportedDomains).toBeDefined()
      expect(data.examples).toBeDefined()
    })
  })

  describe('Health Check Integration', () => {
    it('should report service health status', async () => {
      const healthStatus = await recommendationEngine.healthCheck()
      
      expect(healthStatus).toBeDefined()
      expect(healthStatus.healthy).toBeDefined()
      expect(healthStatus.services).toBeDefined()
      expect(healthStatus.services.qloo).toBeDefined()
      expect(healthStatus.services.gemini).toBeDefined()
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle service unavailability gracefully', async () => {
      // Mock service failure
      const originalQlooService = recommendationEngine['qlooService']
      
      // Temporarily replace with failing service
      const failingService = {
        ...originalQlooService,
        searchEntity: vi.fn().mockRejectedValue(new Error('Service unavailable')),
        getEntityInsights: vi.fn().mockRejectedValue(new Error('Service unavailable'))
      }
      
      recommendationEngine['qlooService'] = failingService as any

      const request: RecommendationRequest = {
        entities: [{ name: 'Test Entity', type: 'movie' }],
        limit: 2
      }

      try {
        const response = await recommendationEngine.generateRecommendations(request)
        // Should either succeed with fallback or fail gracefully
        if (response.success) {
          expect(response.recommendations).toBeDefined()
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      } finally {
        // Restore original service
        recommendationEngine['qlooService'] = originalQlooService
      }
    })

    it('should handle partial service failures', async () => {
      // Mock Gemini service failure while Qloo works
      const originalGeminiService = recommendationEngine['geminiService']
      
      const failingGeminiService = {
        ...originalGeminiService,
        generateBatchExplanations: vi.fn().mockRejectedValue(new Error('Gemini unavailable'))
      }
      
      recommendationEngine['geminiService'] = failingGeminiService as any

      const request: RecommendationRequest = {
        entities: [{ name: 'The Matrix', type: 'movie' }],
        limit: 2,
        includeExplanations: true
      }

      try {
        const response = await recommendationEngine.generateRecommendations(request)
        
        if (response.success) {
          // Should still return recommendations, possibly with fallback explanations
          expect(response.recommendations).toBeDefined()
          
          // Check if fallback explanations are provided
          for (const domain of Object.keys(response.recommendations)) {
            const recs = response.recommendations[domain]
            for (const rec of recs) {
              expect(rec.explanation).toBeDefined()
              // Fallback explanations should still be meaningful
              expect(rec.explanation.length).toBeGreaterThan(0)
            }
          }
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      } finally {
        // Restore original service
        recommendationEngine['geminiService'] = originalGeminiService
      }
    })
  })

  describe('Input Validation and Edge Cases', () => {
    it('should handle special characters in entity names', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Björk', type: 'artist' }, // Unicode characters
          { name: 'AT&T', type: 'brand' }, // Special characters
          { name: 'C++', type: 'brand' } // Programming language with symbols
        ],
        limit: 2
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)
      // Should handle special characters without crashing
    }, 15000)

    it('should handle very long entity names', async () => {
      const longName = 'A'.repeat(200) // Very long name
      const request: RecommendationRequest = {
        entities: [{ name: longName, type: 'brand' }],
        limit: 1
      }

      try {
        const response = await recommendationEngine.generateRecommendations(request)
        // Should either succeed or fail gracefully
        if (response.success) {
          expect(response.recommendations).toBeDefined()
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('should handle empty metadata gracefully', async () => {
      const request: RecommendationRequest = {
        entities: [
          { 
            name: 'Test Entity', 
            type: 'movie',
            metadata: {} // Empty metadata
          }
        ],
        limit: 2
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)
    })
  })

  describe('Domain Filtering', () => {
    it('should respect domain filtering requests', async () => {
      const request: RecommendationRequest = {
        entities: [{ name: 'Marvel', type: 'brand' }],
        domains: ['movie', 'book'], // Only these domains
        limit: 3
      }

      const response = await recommendationEngine.generateRecommendations(request)
      expect(response.success).toBe(true)

      const returnedDomains = Object.keys(response.recommendations)
      for (const domain of returnedDomains) {
        expect(['movie', 'book']).toContain(domain)
      }
    }, 10000)

    it('should handle invalid domain filters gracefully', async () => {
      const request: RecommendationRequest = {
        entities: [{ name: 'Disney', type: 'brand' }],
        domains: ['invalid_domain', 'another_invalid'], // Invalid domains
        limit: 2
      }

      const response = await recommendationEngine.generateRecommendations(request)
      // Should either return empty results or ignore invalid domains
      expect(response.success).toBe(true)
    })
  })
})