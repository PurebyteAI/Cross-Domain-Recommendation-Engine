import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { QlooService, QlooServiceError, QlooServiceConfig, createQlooService } from '../qloo.service'
import { QlooEntity, QlooInsights, QlooRecommendation, QlooTag } from '@/types'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
    isAxiosError: vi.fn()
  }
}))

const mockedAxios = vi.mocked(axios)

describe('QlooService', () => {
  let qlooService: QlooService
  let mockAxiosInstance: any

  const mockConfig: QlooServiceConfig = {
    apiKey: 'test-api-key',
    apiUrl: 'https://test-api.qloo.com',
    retryConfig: {
      maxRetries: 2,
      backoffMultiplier: 1.5,
      initialDelay: 100,
      maxDelay: 1000
    }
  }

  const mockEntity: QlooEntity = {
    id: 'entity-123',
    name: 'Test Entity',
    type: 'movie',
    metadata: { year: 2023 }
  }

  const mockInsights: QlooInsights = {
    tags: [
      {
        tag_id: 'melancholy',
        name: 'Melancholy',
        types: ['mood'],
        subtype: 'emotional',
        affinity: 0.95
      },
      {
        tag_id: 'experimental',
        name: 'Experimental',
        types: ['style'],
        subtype: 'artistic',
        affinity: 0.88
      }
    ]
  }

  const mockRecommendations: QlooRecommendation[] = [
    {
      id: 'rec-1',
      name: 'Recommended Item 1',
      type: 'book',
      confidence: 0.92,
      metadata: { author: 'Test Author' }
    },
    {
      id: 'rec-2',
      name: 'Recommended Item 2',
      type: 'restaurant',
      confidence: 0.87,
      metadata: { cuisine: 'Japanese' }
    }
  ]

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }

    // Setup axios mocks
    vi.mocked(mockedAxios.create).mockReturnValue(mockAxiosInstance)
    vi.mocked(mockedAxios.isAxiosError).mockImplementation((error: any) => {
      return error && error.isAxiosError === true
    })

    qlooService = new QlooService(mockConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(vi.mocked(mockedAxios.create)).toHaveBeenCalledWith({
        baseURL: mockConfig.apiUrl,
        headers: {
          'X-API-Key': mockConfig.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 12000
      })
    })

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('searchEntity', () => {
    it('should successfully search for entities', async () => {
      const mockResponse = {
        data: {
          results: [mockEntity],
          total: 1
        }
      }

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse)

      const result = await qlooService.searchEntity('Test Entity', 'movie')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: {
          q: 'Test Entity',
          types: 'movie',
          limit: 10
        }
      })
      expect(result).toEqual([mockEntity])
    })

    it('should handle search errors with retry', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        },
        message: 'Network Error'
      }

      mockAxiosInstance.get
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: { results: [mockEntity], total: 1 }
        })

      const result = await qlooService.searchEntity('Test Entity', 'movie')

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3)
      expect(result).toEqual([mockEntity])
    })

    it('should not retry on client errors (4xx)', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { error: 'Invalid parameters' }
        },
        message: 'Bad Request'
      }

      mockAxiosInstance.get.mockRejectedValueOnce(mockError)

      await expect(qlooService.searchEntity('', 'invalid')).rejects.toThrow(QlooServiceError)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
    })

    it('should retry on rate limit errors (429)', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 429,
          statusText: 'Too Many Requests'
        },
        message: 'Rate Limited'
      }

      mockAxiosInstance.get
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: { results: [mockEntity], total: 1 }
        })

      const result = await qlooService.searchEntity('Test Entity', 'movie')

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
      expect(result).toEqual([mockEntity])
    })
  })

  describe('getEntityInsights', () => {
    it('should successfully get entity insights', async () => {
      const mockResponse = {
        data: {
          entity: mockEntity,
          insights: mockInsights
        }
      }

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse)

      const result = await qlooService.getEntityInsights('entity-123', 'movie')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/insights', {
        params: {
          'filter.type': 'urn:tag',
          'filter.tag.types': 'urn:tag:genre:media,urn:tag:keyword:media',
          'filter.parents.types': 'urn:entity:movie',
          'signal.interests.entities': 'entity-123'
        }
      })
      expect(result).toEqual(mockInsights)
    })

    it('should handle insights retrieval errors', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Entity not found' }
        },
        message: 'Not Found'
      }

      mockAxiosInstance.get.mockRejectedValueOnce(mockError)

      await expect(qlooService.getEntityInsights('invalid-id', 'movie')).rejects.toThrow(QlooServiceError)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCrossDomainRecommendations', () => {
    it('should successfully get cross-domain recommendations', async () => {
      // Mock response for each domain
      const mockBookResponse = {
        data: {
          results: {
            entities: [mockRecommendations[0]]
          }
        }
      }
      
      const mockRestaurantResponse = {
        data: {
          results: {
            entities: [mockRecommendations[1]]
          }
        }
      }

      mockAxiosInstance.get
        .mockResolvedValueOnce(mockBookResponse)
        .mockResolvedValueOnce(mockRestaurantResponse)

      const result = await qlooService.getCrossDomainRecommendations(
        mockInsights.tags,
        ['book', 'restaurant'],
        5
      )

      // Should make requests for each domain sequentially
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/v2/insights', {
        params: {
          'filter.type': 'urn:entity:book',
          'signal.interests.tags': 'melancholy,experimental',
          'limit': 8
        },
        timeout: 12000
      })
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/v2/insights', {
        params: {
          'filter.type': 'urn:entity:place',
          'signal.interests.tags': 'melancholy,experimental',
          'limit': 8
        },
        timeout: 12000
      })
      expect(result).toEqual(mockRecommendations)
    })

    it('should use default limit when not specified', async () => {
      const mockBookResponse = {
        data: {
          results: {
            entities: [mockRecommendations[0]]
          }
        }
      }
      
      const mockRestaurantResponse = {
        data: {
          results: {
            entities: [mockRecommendations[1]]
          }
        }
      }

      mockAxiosInstance.get
        .mockResolvedValueOnce(mockBookResponse)
        .mockResolvedValueOnce(mockRestaurantResponse)

      await qlooService.getCrossDomainRecommendations(
        mockInsights.tags,
        ['book', 'restaurant']
      )

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('getEntityDetails', () => {
    it('should successfully get entity details', async () => {
      const mockResponse = {
        data: {
          entities: [mockEntity]
        }
      }

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse)

      const result = await qlooService.getEntityDetails(['entity-123'])

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/entities/batch', {
        entity_ids: ['entity-123']
      })
      expect(result).toEqual([mockEntity])
    })
  })

  describe('getEntityRecommendations', () => {
    it('should successfully get entity recommendations', async () => {
      const mockResponse = {
        data: {
          recommendations: mockRecommendations,
          total: 2
        }
      }

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse)

      const result = await qlooService.getEntityRecommendations(
        'entity-123',
        'movie',
        ['book', 'restaurant'],
        10
      )

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/entities/entity-123/recommendations', {
        params: {
          domains: 'book,restaurant',
          limit: 10
        }
      })
      expect(result).toEqual(mockRecommendations)
    })
  })

  describe('retry logic', () => {
    it('should retry with exponential backoff', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        },
        message: 'Server Error'
      }

      const startTime = Date.now()
      
      mockAxiosInstance.get
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: { results: [mockEntity], total: 1 }
        })

      const result = await qlooService.searchEntity('Test Entity', 'movie')

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should have taken at least the initial delay (100ms) + backoff delay (150ms)
      expect(duration).toBeGreaterThan(200)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3)
      expect(result).toEqual([mockEntity])
    })

    it('should fail after max retries', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        },
        message: 'Server Error'
      }

      mockAxiosInstance.get.mockRejectedValue(mockError)

      await expect(qlooService.searchEntity('Test Entity', 'movie')).rejects.toThrow(QlooServiceError)
      
      // Should try initial + maxRetries (2) = 3 times
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3)
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error')

      mockAxiosInstance.get.mockRejectedValueOnce(networkError)

      await expect(qlooService.searchEntity('Test Entity', 'movie')).rejects.toThrow(QlooServiceError)
    })
  })

  describe('QlooServiceError', () => {
    it('should correctly identify retryable errors', () => {
      const serverError = new QlooServiceError('Server Error', 500, 'test')
      const rateLimitError = new QlooServiceError('Rate Limited', 429, 'test')
      const clientError = new QlooServiceError('Bad Request', 400, 'test')

      expect(serverError.isRetryable).toBe(true)
      expect(rateLimitError.isRetryable).toBe(true)
      expect(clientError.isRetryable).toBe(false)
    })

    it('should correctly identify error types', () => {
      const serverError = new QlooServiceError('Server Error', 500, 'test')
      const rateLimitError = new QlooServiceError('Rate Limited', 429, 'test')
      const clientError = new QlooServiceError('Bad Request', 400, 'test')

      expect(serverError.isServerError).toBe(true)
      expect(serverError.isClientError).toBe(false)
      expect(serverError.isRateLimit).toBe(false)

      expect(rateLimitError.isRateLimit).toBe(true)
      expect(rateLimitError.isClientError).toBe(true)

      expect(clientError.isClientError).toBe(true)
      expect(clientError.isServerError).toBe(false)
    })
  })

  describe('createQlooService factory', () => {
    it('should throw error when API key is missing', () => {
      const originalEnv = process.env.QLOO_API_KEY
      delete process.env.QLOO_API_KEY

      expect(() => createQlooService()).toThrow('QLOO_API_KEY environment variable is required')

      // Restore environment
      if (originalEnv) {
        process.env.QLOO_API_KEY = originalEnv
      }
    })

    it('should create service with environment configuration', () => {
      process.env.QLOO_API_KEY = 'test-key'
      process.env.QLOO_API_URL = 'https://test.api.com'

      expect(() => createQlooService()).not.toThrow()
    })
  })
})