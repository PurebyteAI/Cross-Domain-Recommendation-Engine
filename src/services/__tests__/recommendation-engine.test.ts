import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RecommendationEngine } from '../recommendation-engine'
import { CachedQlooService } from '../cached-qloo.service'
import { GeminiService } from '../gemini.service'
import { 
  Entity, 
  QlooTag, 
  QlooInsights, 
  QlooRecommendation, 
  RecommendationRequest,
  QlooEntity
} from '@/types'

// Mock the services
vi.mock('../cached-qloo.service')
vi.mock('../gemini.service')

describe('RecommendationEngine', () => {
  let recommendationEngine: RecommendationEngine
  let mockQlooService: vi.Mocked<CachedQlooService>
  let mockGeminiService: vi.Mocked<GeminiService>

  // Test data
  const mockEntity: Entity = {
    id: 'radiohead-123',
    name: 'Radiohead',
    type: 'artist'
  }

  const mockQlooTags: QlooTag[] = [
    {
      tag_id: 'melancholy',
      name: 'melancholy',
      types: ['music', 'movie'],
      subtype: 'mood',
      affinity: 0.95
    },
    {
      tag_id: 'experimental',
      name: 'experimental',
      types: ['music', 'book'],
      subtype: 'style',
      affinity: 0.88
    },
    {
      tag_id: 'introspective',
      name: 'introspective',
      types: ['music', 'movie', 'book'],
      subtype: 'mood',
      affinity: 0.92
    }
  ]

  const mockQlooInsights: QlooInsights = {
    tags: mockQlooTags
  }

  const mockQlooRecommendations: QlooRecommendation[] = [
    {
      id: 'eternal-sunshine-456',
      name: 'Eternal Sunshine of the Spotless Mind',
      type: 'movie',
      confidence: 0.89,
      metadata: { year: 2004, director: 'Michel Gondry' }
    },
    {
      id: 'kafka-shore-789',
      name: 'Kafka on the Shore',
      type: 'book',
      confidence: 0.85,
      metadata: { author: 'Haruki Murakami', year: 2002 }
    },
    {
      id: 'minimalist-restaurant-101',
      name: 'Rintaro',
      type: 'restaurant',
      confidence: 0.82,
      metadata: { cuisine: 'Japanese', location: 'San Francisco' }
    }
  ]

  const mockSearchResults: QlooEntity[] = [
    {
      id: 'radiohead-123',
      name: 'Radiohead',
      type: 'artist',
      metadata: { genre: 'Alternative Rock' }
    }
  ]

  beforeEach(() => {
    // Create mock instances
    mockQlooService = {
      searchEntity: vi.fn(),
      getEntityInsights: vi.fn(),
      getCrossDomainRecommendations: vi.fn(),
      getEntityRecommendations: vi.fn(),
      getEntityDetails: vi.fn(),
      getCacheStats: vi.fn()
    } as any

    mockGeminiService = {
      generateBatchExplanations: vi.fn(),
      getModelInfo: vi.fn()
    } as any

    // Setup default mock implementations
    mockQlooService.searchEntity.mockResolvedValue(mockSearchResults)
    mockQlooService.getEntityInsights.mockResolvedValue(mockQlooInsights)
    mockQlooService.getCrossDomainRecommendations.mockResolvedValue(mockQlooRecommendations)
    mockQlooService.getEntityRecommendations.mockResolvedValue(mockQlooRecommendations)
    mockQlooService.getCacheStats.mockResolvedValue({ l1: {}, l2: {} })

    mockGeminiService.generateBatchExplanations.mockResolvedValue({
      explanations: [
        {
          entityId: 'eternal-sunshine-456',
          explanation: 'Like Radiohead\'s introspective melancholy, this film explores memory and emotional depth.',
          confidence: 0.89,
          filtered: false
        },
        {
          entityId: 'kafka-shore-789',
          explanation: 'Both share surreal, experimental narratives that blend reality with introspection.',
          confidence: 0.85,
          filtered: false
        },
        {
          entityId: 'minimalist-restaurant-101',
          explanation: 'The minimalist aesthetic and attention to detail mirrors Radiohead\'s precise artistry.',
          confidence: 0.82,
          filtered: false
        }
      ],
      totalProcessingTime: 1500,
      successCount: 3,
      failureCount: 0
    })

    mockGeminiService.getModelInfo.mockReturnValue({
      model: 'gemini-2.5-flash',
      config: { temperature: 0.7 }
    })

    // Create recommendation engine instance
    recommendationEngine = new RecommendationEngine({
      qlooService: mockQlooService,
      geminiService: mockGeminiService,
      defaultLimit: 5,
      confidenceThreshold: 0.3,
      maxCrossDomainResults: 50
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('generateRecommendations', () => {
    it('should generate cross-domain recommendations successfully', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity],
        domains: ['movie', 'book', 'restaurant'],
        limit: 3,
        includeExplanations: true
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      expect(result.input).toEqual([mockEntity])
      expect(result.recommendations).toBeDefined()
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.cached).toBe('boolean')

      // Should have recommendations for multiple domains
      const domains = Object.keys(result.recommendations)
      expect(domains.length).toBeGreaterThanOrEqual(1)

      // Each recommendation should have required fields
      for (const domainRecs of Object.values(result.recommendations)) {
        for (const rec of domainRecs) {
          expect(rec).toHaveProperty('id')
          expect(rec).toHaveProperty('name')
          expect(rec).toHaveProperty('type')
          expect(rec).toHaveProperty('confidence')
          expect(rec).toHaveProperty('explanation')
          expect(rec).toHaveProperty('metadata')
          expect(rec.confidence).toBeGreaterThanOrEqual(0)
          expect(rec.confidence).toBeLessThanOrEqual(1)
        }
      }
    })

    it('should handle entity search when ID is not provided', async () => {
      const entityWithoutId: Entity = {
        name: 'Radiohead',
        type: 'artist'
      }

      const request: RecommendationRequest = {
        entities: [entityWithoutId],
        limit: 3
      }

      await recommendationEngine.generateRecommendations(request)

      expect(mockQlooService.searchEntity).toHaveBeenCalledWith('Radiohead', 'artist')
      expect(mockQlooService.getEntityInsights).toHaveBeenCalledWith('radiohead-123')
    })

    it('should generate recommendations without explanations when requested', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity],
        includeExplanations: false
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      expect(mockGeminiService.generateBatchExplanations).not.toHaveBeenCalled()

      // Explanations should be empty strings
      for (const domainRecs of Object.values(result.recommendations)) {
        for (const rec of domainRecs) {
          expect(rec.explanation).toBe('')
        }
      }
    })

    it('should respect the limit parameter', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity],
        limit: 2
      }

      const result = await recommendationEngine.generateRecommendations(request)

      // Each domain should have at most 2 recommendations
      for (const domainRecs of Object.values(result.recommendations)) {
        expect(domainRecs.length).toBeLessThanOrEqual(2)
      }
    })

    it('should filter domains when specified', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity],
        domains: ['movie', 'book']
      }

      await recommendationEngine.generateRecommendations(request)

      expect(mockQlooService.getCrossDomainRecommendations).toHaveBeenCalledWith(
        expect.any(Array),
        ['movie', 'book'],
        50
      )
    })

    it('should handle errors gracefully', async () => {
      // Mock getCrossDomainRecommendations to throw error (this will propagate)
      mockQlooService.getCrossDomainRecommendations.mockRejectedValue(new Error('API Error'))

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      await expect(recommendationEngine.generateRecommendations(request)).rejects.toThrow('API Error')
    })

    it('should continue processing other entities when one fails', async () => {
      const entities: Entity[] = [
        mockEntity,
        { name: 'Unknown Artist', type: 'artist' }
      ]

      // Mock search to fail for the second entity
      mockQlooService.searchEntity
        .mockResolvedValueOnce(mockSearchResults)
        .mockResolvedValueOnce([]) // No results for unknown artist

      const request: RecommendationRequest = {
        entities
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      // Should still process the first entity successfully
      expect(mockQlooService.getEntityInsights).toHaveBeenCalledWith('radiohead-123')
    })
  })

  describe('taste analysis', () => {
    it('should extract cultural themes from entities', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      await recommendationEngine.generateRecommendations(request)

      expect(mockQlooService.getEntityInsights).toHaveBeenCalledWith('radiohead-123')
    })

    it('should deduplicate similar themes', async () => {
      // Mock insights with duplicate themes
      const duplicateInsights: QlooInsights = {
        tags: [
          ...mockQlooTags,
          {
            tag_id: 'melancholy',
            name: 'melancholy',
            types: ['music'],
            subtype: 'mood',
            affinity: 0.90 // Lower affinity
          }
        ]
      }

      mockQlooService.getEntityInsights.mockResolvedValue(duplicateInsights)

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      // Should handle duplicates without errors
    })
  })

  describe('cross-domain mapping', () => {
    it('should generate recommendations across multiple domains', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(mockQlooService.getCrossDomainRecommendations).toHaveBeenCalled()
      
      // Should have recommendations from different domains
      const domains = Object.keys(result.recommendations)
      expect(domains.length).toBeGreaterThan(0)
    })

    it('should try individual entity recommendations when cross-domain results are insufficient', async () => {
      // Mock cross-domain to return limited results
      mockQlooService.getCrossDomainRecommendations.mockResolvedValue([
        mockQlooRecommendations[0] // Only one recommendation
      ])

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      await recommendationEngine.generateRecommendations(request)

      // Should try to get more recommendations using individual entity
      expect(mockQlooService.getEntityRecommendations).toHaveBeenCalled()
    })

    it('should filter recommendations by confidence threshold', async () => {
      // Create engine with higher confidence threshold
      const strictEngine = new RecommendationEngine({
        qlooService: mockQlooService,
        geminiService: mockGeminiService,
        confidenceThreshold: 0.9 // High threshold
      })

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await strictEngine.generateRecommendations(request)

      // Should filter out low-confidence recommendations
      for (const domainRecs of Object.values(result.recommendations)) {
        for (const rec of domainRecs) {
          expect(rec.confidence).toBeGreaterThanOrEqual(0.9)
        }
      }
    })
  })

  describe('explanation generation', () => {
    it('should generate explanations for recommendations', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity],
        includeExplanations: true
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(mockGeminiService.generateBatchExplanations).toHaveBeenCalled()

      // All recommendations should have explanations
      for (const domainRecs of Object.values(result.recommendations)) {
        for (const rec of domainRecs) {
          expect(rec.explanation).toBeTruthy()
          expect(rec.explanation.length).toBeGreaterThan(0)
        }
      }
    })

    it('should provide fallback explanations when Gemini fails', async () => {
      mockGeminiService.generateBatchExplanations.mockRejectedValue(new Error('Gemini API Error'))

      const request: RecommendationRequest = {
        entities: [mockEntity],
        includeExplanations: true
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      
      // Should still have explanations (fallback ones)
      for (const domainRecs of Object.values(result.recommendations)) {
        for (const rec of domainRecs) {
          expect(rec.explanation).toBeTruthy()
          expect(rec.explanation).toContain('Based on your interest in')
        }
      }
    })
  })

  describe('result aggregation and ranking', () => {
    it('should remove duplicate recommendations', async () => {
      // Mock recommendations with duplicates
      const duplicateRecs = [
        ...mockQlooRecommendations,
        {
          id: 'eternal-sunshine-duplicate',
          name: 'Eternal Sunshine of the Spotless Mind', // Same name
          type: 'movie',
          confidence: 0.75,
          metadata: {}
        }
      ]

      mockQlooService.getCrossDomainRecommendations.mockResolvedValue(duplicateRecs)

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      // Should not have duplicate recommendations
      const movieRecs = result.recommendations.movie || []
      const movieNames = movieRecs.map(rec => rec.name.toLowerCase())
      const uniqueNames = new Set(movieNames)
      expect(movieNames.length).toBe(uniqueNames.size)
    })

    it('should sort recommendations by confidence', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      // Each domain's recommendations should be sorted by confidence (descending)
      for (const domainRecs of Object.values(result.recommendations)) {
        for (let i = 1; i < domainRecs.length; i++) {
          expect(domainRecs[i-1].confidence).toBeGreaterThanOrEqual(domainRecs[i].confidence)
        }
      }
    })
  })

  describe('health check', () => {
    it('should return healthy status when all services are working', async () => {
      const health = await recommendationEngine.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.services.qloo).toBe(true)
      expect(health.services.gemini).toBe(true)
    })

    it('should return unhealthy status when services fail', async () => {
      mockQlooService.getCacheStats.mockRejectedValue(new Error('Service down'))

      const health = await recommendationEngine.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.services.qloo).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty input entities', async () => {
      const request: RecommendationRequest = {
        entities: []
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      expect(result.recommendations).toEqual({})
    })

    it('should handle entities not found in Qloo', async () => {
      mockQlooService.searchEntity.mockResolvedValue([]) // No search results

      const request: RecommendationRequest = {
        entities: [{ name: 'Unknown Entity', type: 'artist' }]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      // Should not call getEntityInsights for unfound entities
      expect(mockQlooService.getEntityInsights).not.toHaveBeenCalled()
    })

    it('should handle no cultural themes extracted', async () => {
      mockQlooService.getEntityInsights.mockResolvedValue({ tags: [] })

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      expect(result.recommendations).toEqual({})
    })

    it('should handle no cross-domain recommendations found', async () => {
      mockQlooService.getCrossDomainRecommendations.mockResolvedValue([])
      mockQlooService.getEntityRecommendations.mockResolvedValue([])

      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      expect(result.recommendations).toEqual({})
    })
  })

  describe('performance requirements', () => {
    it('should complete within reasonable time', async () => {
      const request: RecommendationRequest = {
        entities: [mockEntity]
      }

      const startTime = Date.now()
      const result = await recommendationEngine.generateRecommendations(request)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.processingTime).toBeGreaterThanOrEqual(0) // Allow 0 for fast mock responses
    })

    it('should handle multiple entities efficiently', async () => {
      // Clear previous mock calls
      vi.clearAllMocks()
      
      const multipleEntities: Entity[] = [
        { id: '1', name: 'Radiohead', type: 'artist' },
        { id: '2', name: 'The Beatles', type: 'artist' },
        { id: '3', name: 'Pink Floyd', type: 'artist' }
      ]

      // Reset mock implementations for this test
      mockQlooService.getEntityInsights.mockResolvedValue(mockQlooInsights)
      mockQlooService.getCrossDomainRecommendations.mockResolvedValue(mockQlooRecommendations)
      mockGeminiService.generateBatchExplanations.mockResolvedValue({
        explanations: mockQlooRecommendations.map(rec => ({
          entityId: rec.id,
          explanation: 'Test explanation',
          confidence: rec.confidence,
          filtered: false
        })),
        totalProcessingTime: 1000,
        successCount: 3,
        failureCount: 0
      })

      const request: RecommendationRequest = {
        entities: multipleEntities
      }

      const result = await recommendationEngine.generateRecommendations(request)

      expect(result.success).toBe(true)
      expect(result.input).toEqual(multipleEntities)
      
      // Should have called insights for each entity (at least 3 times, may be more for explanations)
      expect(mockQlooService.getEntityInsights).toHaveBeenCalledWith('1')
      expect(mockQlooService.getEntityInsights).toHaveBeenCalledWith('2')
      expect(mockQlooService.getEntityInsights).toHaveBeenCalledWith('3')
    })
  })
})