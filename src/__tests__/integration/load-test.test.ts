import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { RecommendationEngine } from '@/services/recommendation-engine'
import { createCachedQlooService } from '@/services/cached-qloo.service'
import { GeminiService } from '@/services/gemini.service'
import { RecommendationRequest } from '@/types'

interface LoadTestResult {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  requestsPerSecond: number
  errorRate: number
}

describe('Load Testing', () => {
  let recommendationEngine: RecommendationEngine

  beforeAll(async () => {
    process.env.QLOO_API_KEY = process.env.QLOO_API_KEY || 'test-qloo-key'
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key'
    process.env.GEMINI_MODEL = 'gemini-1.5-flash'

    const qlooService = createCachedQlooService()
    const geminiService = new GeminiService({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    })

    recommendationEngine = new RecommendationEngine({
      qlooService,
      geminiService,
      defaultLimit: 3, // Smaller limit for load testing
      confidenceThreshold: 0.3,
      maxCrossDomainResults: 30
    })
  })

  async function runLoadTest(
    requests: RecommendationRequest[],
    concurrency: number = 5,
    duration?: number
  ): Promise<LoadTestResult> {
    const results: number[] = []
    const errors: Error[] = []
    const startTime = Date.now()
    let requestCount = 0

    const executeRequest = async (request: RecommendationRequest): Promise<number> => {
      const reqStartTime = Date.now()
      try {
        const response = await recommendationEngine.generateRecommendations(request)
        const reqEndTime = Date.now()
        const responseTime = reqEndTime - reqStartTime
        
        if (response.success) {
          return responseTime
        } else {
          throw new Error('Request failed')
        }
      } catch (error) {
        errors.push(error as Error)
        return -1 // Indicate failure
      }
    }

    // Run concurrent requests
    const promises: Promise<void>[] = []
    
    for (let i = 0; i < concurrency; i++) {
      promises.push((async () => {
        let requestIndex = 0
        
        while (true) {
          // Check if we should stop (duration-based or request-based)
          if (duration && Date.now() - startTime > duration) break
          if (!duration && requestIndex >= requests.length) break
          
          const request = requests[requestIndex % requests.length]
          const responseTime = await executeRequest(request)
          
          if (responseTime > 0) {
            results.push(responseTime)
          }
          
          requestCount++
          requestIndex++
          
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      })())
    }

    await Promise.all(promises)
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // Calculate statistics
    const successfulRequests = results.length
    const failedRequests = errors.length
    const totalRequests = successfulRequests + failedRequests
    
    if (results.length === 0) {
      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 1
      }
    }
    
    const sortedResults = results.sort((a, b) => a - b)
    const averageResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length
    const minResponseTime = sortedResults[0]
    const maxResponseTime = sortedResults[sortedResults.length - 1]
    const p95Index = Math.floor(sortedResults.length * 0.95)
    const p95ResponseTime = sortedResults[p95Index]
    const requestsPerSecond = (totalRequests / totalTime) * 1000
    const errorRate = failedRequests / totalRequests

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      p95ResponseTime,
      requestsPerSecond,
      errorRate
    }
  }

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent requests efficiently', async () => {
      const requests: RecommendationRequest[] = [
        { entities: [{ name: 'Apple', type: 'brand' }], limit: 2 },
        { entities: [{ name: 'Google', type: 'brand' }], limit: 2 },
        { entities: [{ name: 'Microsoft', type: 'brand' }], limit: 2 },
        { entities: [{ name: 'Amazon', type: 'brand' }], limit: 2 },
        { entities: [{ name: 'Facebook', type: 'brand' }], limit: 2 }
      ]

      const result = await runLoadTest(requests, 10)

      console.log('Load Test Results (10 concurrent):', result)

      expect(result.totalRequests).toBeGreaterThan(0)
      expect(result.errorRate).toBeLessThan(0.1) // Less than 10% error rate
      expect(result.averageResponseTime).toBeLessThan(8000) // Average under 8 seconds
      expect(result.p95ResponseTime).toBeLessThan(12000) // 95th percentile under 12 seconds
    }, 60000)

    it('should maintain performance under sustained load', async () => {
      const requests: RecommendationRequest[] = [
        { entities: [{ name: 'Netflix', type: 'brand' }], limit: 2, includeExplanations: false },
        { entities: [{ name: 'Spotify', type: 'brand' }], limit: 2, includeExplanations: false },
        { entities: [{ name: 'Disney', type: 'brand' }], limit: 2, includeExplanations: false }
      ]

      // Run for 30 seconds with 5 concurrent requests
      const result = await runLoadTest(requests, 5, 30000)

      console.log('Sustained Load Test Results:', result)

      expect(result.totalRequests).toBeGreaterThan(10) // Should complete multiple requests
      expect(result.errorRate).toBeLessThan(0.2) // Less than 20% error rate under load
      expect(result.requestsPerSecond).toBeGreaterThan(0.1) // At least 0.1 RPS
    }, 45000)
  })

  describe('Stress Testing', () => {
    it('should handle high concurrency gracefully', async () => {
      const requests: RecommendationRequest[] = [
        { entities: [{ name: 'Tesla', type: 'brand' }], limit: 1, includeExplanations: false },
        { entities: [{ name: 'Nike', type: 'brand' }], limit: 1, includeExplanations: false }
      ]

      // High concurrency test
      const result = await runLoadTest(requests, 20)

      console.log('High Concurrency Test Results:', result)

      expect(result.totalRequests).toBeGreaterThan(0)
      // Under high load, we accept higher error rates but system should not crash
      expect(result.errorRate).toBeLessThan(0.5) // Less than 50% error rate
      
      if (result.successfulRequests > 0) {
        expect(result.averageResponseTime).toBeLessThan(15000) // 15 seconds max average
      }
    }, 90000)

    it('should recover from overload conditions', async () => {
      const heavyRequests: RecommendationRequest[] = [
        { 
          entities: [
            { name: 'Marvel', type: 'brand' },
            { name: 'DC Comics', type: 'brand' },
            { name: 'Disney', type: 'brand' }
          ], 
          limit: 5, 
          includeExplanations: true 
        }
      ]

      // First, create overload condition
      const overloadResult = await runLoadTest(heavyRequests, 15)
      
      console.log('Overload Test Results:', overloadResult)

      // Then test recovery with lighter load
      const lightRequests: RecommendationRequest[] = [
        { entities: [{ name: 'Coca-Cola', type: 'brand' }], limit: 1, includeExplanations: false }
      ]

      // Wait a bit for recovery
      await new Promise(resolve => setTimeout(resolve, 2000))

      const recoveryResult = await runLoadTest(lightRequests, 3)
      
      console.log('Recovery Test Results:', recoveryResult)

      // System should recover and handle lighter load better
      expect(recoveryResult.errorRate).toBeLessThan(overloadResult.errorRate)
      
      if (recoveryResult.successfulRequests > 0) {
        expect(recoveryResult.averageResponseTime).toBeLessThan(10000)
      }
    }, 120000)
  })

  describe('Resource Exhaustion Testing', () => {
    it('should handle memory pressure gracefully', async () => {
      const memoryIntensiveRequests: RecommendationRequest[] = [
        { 
          entities: [
            { name: 'Warner Bros', type: 'brand' },
            { name: 'Universal Studios', type: 'brand' },
            { name: 'Paramount', type: 'brand' }
          ], 
          limit: 8, 
          includeExplanations: true 
        }
      ]

      const initialMemory = process.memoryUsage()
      
      const result = await runLoadTest(memoryIntensiveRequests, 8)
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log('Memory Usage Test:', {
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB',
        finalMemory: Math.round(finalMemory.heapUsed / 1024 / 1024) + 'MB',
        increase: Math.round(memoryIncrease / 1024 / 1024) + 'MB',
        result
      })

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024) // Less than 200MB increase
      
      // System should still function
      expect(result.totalRequests).toBeGreaterThan(0)
    }, 60000)
  })

  describe('Cache Performance Under Load', () => {
    it('should show improved performance with cache warming', async () => {
      const cacheableRequests: RecommendationRequest[] = [
        { entities: [{ name: 'McDonald\'s', type: 'restaurant' }], limit: 2 },
        { entities: [{ name: 'Starbucks', type: 'restaurant' }], limit: 2 }
      ]

      // First run to warm cache
      console.log('Warming cache...')
      await runLoadTest(cacheableRequests, 2)

      // Wait for cache to settle
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Second run should be faster due to cache
      console.log('Testing with warmed cache...')
      const cachedResult = await runLoadTest(cacheableRequests, 5)

      console.log('Cached Performance Results:', cachedResult)

      expect(cachedResult.totalRequests).toBeGreaterThan(0)
      expect(cachedResult.errorRate).toBeLessThan(0.1)
      
      if (cachedResult.successfulRequests > 0) {
        // With cache, performance should be better
        expect(cachedResult.averageResponseTime).toBeLessThan(5000)
        expect(cachedResult.requestsPerSecond).toBeGreaterThan(0.2)
      }
    }, 45000)
  })

  describe('Mixed Workload Testing', () => {
    it('should handle diverse request patterns', async () => {
      const mixedRequests: RecommendationRequest[] = [
        // Fast requests
        { entities: [{ name: 'Twitter', type: 'brand' }], limit: 1, includeExplanations: false },
        { entities: [{ name: 'Instagram', type: 'brand' }], limit: 1, includeExplanations: false },
        
        // Medium requests
        { entities: [{ name: 'YouTube', type: 'brand' }], limit: 3, includeExplanations: true },
        { entities: [{ name: 'TikTok', type: 'brand' }], limit: 3, includeExplanations: true },
        
        // Slower requests
        { 
          entities: [
            { name: 'HBO', type: 'brand' },
            { name: 'Netflix', type: 'brand' }
          ], 
          limit: 5, 
          includeExplanations: true 
        }
      ]

      const result = await runLoadTest(mixedRequests, 8)

      console.log('Mixed Workload Results:', result)

      expect(result.totalRequests).toBeGreaterThan(0)
      expect(result.errorRate).toBeLessThan(0.3) // Mixed load may have higher error rate
      
      if (result.successfulRequests > 0) {
        // Should handle mixed workload reasonably
        expect(result.p95ResponseTime).toBeLessThan(20000) // 20 seconds for 95th percentile
      }
    }, 75000)
  })
})