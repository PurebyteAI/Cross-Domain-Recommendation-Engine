import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { RecommendationEngine } from '@/services/recommendation-engine'
import { createCachedQlooService } from '@/services/cached-qloo.service'
import { GeminiService } from '@/services/gemini.service'
import { RecommendationRequest } from '@/types'

describe('Performance Tests', () => {
  let recommendationEngine: RecommendationEngine
  let qlooService: any
  let geminiService: GeminiService

  beforeAll(async () => {
    // Set up test environment
    process.env.QLOO_API_KEY = process.env.QLOO_API_KEY || 'test-qloo-key'
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key'
    process.env.GEMINI_MODEL = 'gemini-1.5-flash'

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

  describe('Response Time Requirements', () => {
    it('should complete single entity recommendations within 3 seconds', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'The Beatles', type: 'artist' }
        ],
        limit: 5,
        includeExplanations: true
      }

      const startTime = Date.now()
      const response = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(response.success).toBe(true)
      expect(totalTime).toBeLessThan(3000) // Requirement 1.1: within 3 seconds
      expect(response.processingTime).toBeLessThan(3000)
    }, 5000)

    it('should maintain 95% of requests under 5 seconds', async () => {
      const requests: RecommendationRequest[] = [
        { entities: [{ name: 'Marvel', type: 'brand' }], limit: 3 },
        { entities: [{ name: 'Quentin Tarantino', type: 'artist' }], limit: 3 },
        { entities: [{ name: 'Game of Thrones', type: 'tv_show' }], limit: 3 },
        { entities: [{ name: 'Harry Potter', type: 'book' }], limit: 3 },
        { entities: [{ name: 'Starbucks', type: 'brand' }], limit: 3 },
        { entities: [{ name: 'The Office', type: 'tv_show' }], limit: 3 },
        { entities: [{ name: 'Coldplay', type: 'artist' }], limit: 3 },
        { entities: [{ name: 'McDonald\'s', type: 'restaurant' }], limit: 3 },
        { entities: [{ name: 'Friends', type: 'tv_show' }], limit: 3 },
        { entities: [{ name: 'Apple', type: 'brand' }], limit: 3 }
      ]

      const responseTimes: number[] = []

      for (const request of requests) {
        const startTime = Date.now()
        try {
          const response = await recommendationEngine.generateRecommendations(request)
          const endTime = Date.now()
          const totalTime = endTime - startTime
          
          if (response.success) {
            responseTimes.push(totalTime)
          }
        } catch (error) {
          console.warn('Request failed:', error)
          // Still count failed requests in performance metrics
          responseTimes.push(10000) // Penalty time for failures
        }
      }

      // Calculate 95th percentile
      const sortedTimes = responseTimes.sort((a, b) => a - b)
      const p95Index = Math.floor(sortedTimes.length * 0.95)
      const p95Time = sortedTimes[p95Index]

      console.log('Response times:', sortedTimes)
      console.log('95th percentile:', p95Time)

      expect(p95Time).toBeLessThan(5000) // Requirement 4.3: 95% under 5 seconds
    }, 60000) // 1 minute timeout for all requests

    it('should handle concurrent load efficiently', async () => {
      const concurrentRequests = 5
      const request: RecommendationRequest = {
        entities: [
          { name: 'Disney', type: 'brand' }
        ],
        limit: 3,
        includeExplanations: true
      }

      const startTime = Date.now()

      // Execute concurrent requests
      const promises = Array(concurrentRequests).fill(null).map(() =>
        recommendationEngine.generateRecommendations(request)
      )

      const responses = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      // All requests should succeed
      for (const response of responses) {
        expect(response.success).toBe(true)
      }

      // Concurrent execution should not be significantly slower than sequential
      const averageTime = totalTime / concurrentRequests
      expect(averageTime).toBeLessThan(8000) // Should average under 8 seconds per request
    }, 30000)
  })

  describe('Throughput and Scalability', () => {
    it('should handle multiple entity requests efficiently', async () => {
      const request: RecommendationRequest = {
        entities: [
          { name: 'Christopher Nolan', type: 'artist' },
          { name: 'Inception', type: 'movie' },
          { name: 'Interstellar', type: 'movie' }
        ],
        limit: 3,
        includeExplanations: true
      }

      const startTime = Date.now()
      const response = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(response.success).toBe(true)
      expect(totalTime).toBeLessThan(8000) // Multiple entities should still complete reasonably fast
    }, 10000)

    it('should scale processing time reasonably with entity count', async () => {
      const singleEntityRequest: RecommendationRequest = {
        entities: [{ name: 'Netflix', type: 'brand' }],
        limit: 2,
        includeExplanations: false // Disable explanations for faster processing
      }

      const multipleEntityRequest: RecommendationRequest = {
        entities: [
          { name: 'Netflix', type: 'brand' },
          { name: 'Amazon', type: 'brand' },
          { name: 'Google', type: 'brand' }
        ],
        limit: 2,
        includeExplanations: false
      }

      // Test single entity
      const startTime1 = Date.now()
      const response1 = await recommendationEngine.generateRecommendations(singleEntityRequest)
      const endTime1 = Date.now()
      const singleTime = endTime1 - startTime1

      // Test multiple entities
      const startTime2 = Date.now()
      const response2 = await recommendationEngine.generateRecommendations(multipleEntityRequest)
      const endTime2 = Date.now()
      const multipleTime = endTime2 - startTime2

      expect(response1.success).toBe(true)
      expect(response2.success).toBe(true)

      // Multiple entities should not be more than 3x slower than single entity
      expect(multipleTime).toBeLessThan(singleTime * 3)
    }, 15000)
  })

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated requests', async () => {
      const request: RecommendationRequest = {
        entities: [{ name: 'Spotify', type: 'brand' }],
        limit: 2,
        includeExplanations: false
      }

      // Get initial memory usage
      const initialMemory = process.memoryUsage()

      // Execute multiple requests
      for (let i = 0; i < 10; i++) {
        const response = await recommendationEngine.generateRecommendations(request)
        expect(response.success).toBe(true)
      }

      // Check memory usage after requests
      const finalMemory = process.memoryUsage()

      // Memory increase should be reasonable (less than 50MB)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB
    }, 30000)

    it('should handle large result sets efficiently', async () => {
      const request: RecommendationRequest = {
        entities: [{ name: 'Marvel', type: 'brand' }],
        limit: 10, // Request more results
        includeExplanations: true
      }

      const startTime = Date.now()
      const response = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(response.success).toBe(true)
      expect(totalTime).toBeLessThan(10000) // Should still complete within 10 seconds

      // Count total recommendations
      const totalRecs = Object.values(response.recommendations)
        .reduce((sum, recs) => sum + recs.length, 0)
      
      expect(totalRecs).toBeGreaterThan(0)
    }, 15000)
  })

  describe('Cache Performance', () => {
    it('should show significant performance improvement with caching', async () => {
      const request: RecommendationRequest = {
        entities: [{ name: 'Tesla', type: 'brand' }],
        limit: 3,
        includeExplanations: true
      }

      // First request (cache miss)
      const startTime1 = Date.now()
      const response1 = await recommendationEngine.generateRecommendations(request)
      const endTime1 = Date.now()
      const firstTime = endTime1 - startTime1

      expect(response1.success).toBe(true)

      // Second request (should hit cache)
      const startTime2 = Date.now()
      const response2 = await recommendationEngine.generateRecommendations(request)
      const endTime2 = Date.now()
      const secondTime = endTime2 - startTime2

      expect(response2.success).toBe(true)

      // Second request should be significantly faster
      expect(secondTime).toBeLessThan(firstTime * 0.8) // At least 20% faster
    }, 20000)
  })

  describe('Error Recovery Performance', () => {
    it('should fail fast on invalid requests', async () => {
      const invalidRequest = {
        entities: [], // Invalid: empty array
        limit: 5
      } as RecommendationRequest

      const startTime = Date.now()
      
      try {
        await recommendationEngine.generateRecommendations(invalidRequest)
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        const endTime = Date.now()
        const totalTime = endTime - startTime
        
        // Should fail quickly (under 100ms)
        expect(totalTime).toBeLessThan(100)
      }
    })

    it('should handle service timeouts gracefully', async () => {
      // Test with a request that might timeout
      const request: RecommendationRequest = {
        entities: [
          { name: 'VeryObscureEntity12345', type: 'movie' }
        ],
        limit: 5
      }

      const startTime = Date.now()
      
      try {
        const response = await recommendationEngine.generateRecommendations(request)
        const endTime = Date.now()
        const totalTime = endTime - startTime
        
        // Should either succeed or fail within reasonable time
        expect(totalTime).toBeLessThan(15000) // 15 seconds max
        
        if (response.success) {
          expect(response.recommendations).toBeDefined()
        }
      } catch (error) {
        const endTime = Date.now()
        const totalTime = endTime - startTime
        
        // Even failures should not take too long
        expect(totalTime).toBeLessThan(15000)
      }
    }, 20000)
  })
})