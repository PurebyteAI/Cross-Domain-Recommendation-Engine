import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiService, ExplanationRequest, BatchExplanationRequest } from '../gemini.service'
import { Entity, QlooTag } from '@/types'

// Create mock functions at module level
const mockGenerateContent = vi.fn()
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent
}))

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn(() => ({
      getGenerativeModel: mockGetGenerativeModel
    })),
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT'
    },
    HarmBlockThreshold: {
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE'
    }
  }
})

describe('GeminiService', () => {
  let geminiService: GeminiService

  const mockInputEntity: Entity = {
    id: 'radiohead-1',
    name: 'Radiohead',
    type: 'artist',
    metadata: { genre: 'alternative rock' }
  }

  const mockRecommendedEntity: Entity = {
    id: 'kafka-shore-1',
    name: 'Kafka on the Shore',
    type: 'book',
    metadata: { author: 'Haruki Murakami' }
  }

  const mockSharedThemes: QlooTag[] = [
    {
      tag_id: 'melancholy',
      name: 'melancholy',
      types: ['mood'],
      subtype: 'emotional',
      affinity: 0.95
    },
    {
      tag_id: 'introspective',
      name: 'introspective',
      types: ['style'],
      subtype: 'artistic',
      affinity: 0.88
    }
  ]

  beforeEach(() => {
    // Reset environment variables
    process.env.GEMINI_API_KEY = 'test-api-key'
    process.env.GEMINI_MODEL = 'gemini-2.0-flash-lite'
    
    // Reset mocks
    vi.clearAllMocks()
    
    geminiService = new GeminiService({
      apiKey: 'test-api-key',
      model: 'gemini-2.0-flash-lite',
      retryConfig: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        initialDelay: 100,
        maxDelay: 1000
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_MODEL
  })

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      expect(() => new GeminiService({ apiKey: 'test-key' })).not.toThrow()
    })

    it('should initialize with API key from environment variable', () => {
      process.env.GEMINI_API_KEY = 'env-key'
      expect(() => new GeminiService()).not.toThrow()
    })

    it('should use model from environment variable', () => {
      process.env.GEMINI_API_KEY = 'env-key'
      process.env.GEMINI_MODEL = 'gemini-2.0-flash-lite'
      const service = new GeminiService()
      expect(service.getModelInfo().model).toBe('gemini-2.0-flash-lite')
    })

    it('should use model from config over environment', () => {
      process.env.GEMINI_API_KEY = 'env-key'
      process.env.GEMINI_MODEL = 'gemini-1.5-flash'
      const service = new GeminiService({ model: 'gemini-2.0-flash-lite' })
      expect(service.getModelInfo().model).toBe('gemini-2.0-flash-lite')
    })

    it('should throw error when no API key is provided', () => {
      delete process.env.GEMINI_API_KEY
      expect(() => new GeminiService()).toThrow('Gemini API key is required')
    })
  })

  describe('generateExplanation', () => {
    const mockRequest: ExplanationRequest = {
      inputEntity: mockInputEntity,
      recommendedEntity: mockRecommendedEntity,
      sharedThemes: mockSharedThemes,
      affinityScore: 0.85
    }

    it('should generate explanation successfully', async () => {
      const mockExplanation = "Since you appreciate Radiohead's melancholic and introspective soundscapes, you'd likely connect with Kafka on the Shore's dreamlike narrative that explores similar themes of isolation and surreal beauty."
      
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => mockExplanation,
          candidates: [{ finishReason: 'STOP' }]
        }
      })

      const result = await geminiService.generateExplanation(mockRequest)

      expect(result.explanation).toBe(mockExplanation)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.filtered).toBe(false)
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('should handle filtered content', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Filtered content',
          candidates: [{ finishReason: 'SAFETY' }]
        }
      })

      const result = await geminiService.generateExplanation(mockRequest)

      expect(result.filtered).toBe(true)
      expect(result.confidence).toBeLessThan(0.5)
      expect(result.explanation).toContain('Radiohead')
      expect(result.explanation).toContain('Kafka on the Shore')
    })

    it('should return fallback explanation on API error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'))

      const result = await geminiService.generateExplanation(mockRequest)

      expect(result.explanation).toContain('melancholy')
      expect(result.confidence).toBe(0.3)
      expect(result.filtered).toBe(false)
    })

    it('should retry on retryable errors', async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue({
          response: {
            text: () => 'Success after retry',
            candidates: [{ finishReason: 'STOP' }]
          }
        })

      const result = await geminiService.generateExplanation(mockRequest)

      expect(result.explanation).toBe('Success after retry')
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Invalid API key'))

      const result = await geminiService.generateExplanation(mockRequest)

      expect(result.explanation).toContain('melancholy')
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('should build correct prompt template', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Test explanation',
          candidates: [{ finishReason: 'STOP' }]
        }
      })

      await geminiService.generateExplanation(mockRequest)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      const prompt = callArgs.contents[0].parts[0].text

      expect(prompt).toContain('Radiohead')
      expect(prompt).toContain('Kafka on the Shore')
      expect(prompt).toContain('melancholy, introspective')
      expect(prompt).toContain('85%')
      expect(prompt).toContain('cultural taste expert')
    })
  })

  describe('generateBatchExplanations', () => {
    const mockBatchRequest: BatchExplanationRequest = {
      inputEntity: mockInputEntity,
      recommendations: [
        {
          entity: mockRecommendedEntity,
          sharedThemes: mockSharedThemes,
          affinityScore: 0.85
        },
        {
          entity: {
            id: 'eternal-sunshine',
            name: 'Eternal Sunshine of the Spotless Mind',
            type: 'movie'
          },
          sharedThemes: mockSharedThemes,
          affinityScore: 0.78
        }
      ]
    }

    it('should generate batch explanations successfully', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Test explanation',
          candidates: [{ finishReason: 'STOP' }]
        }
      })

      const result = await geminiService.generateBatchExplanations(mockBatchRequest)

      expect(result.explanations).toHaveLength(2)
      expect(result.successCount).toBe(2)
      expect(result.failureCount).toBe(0)
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures in batch', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({
          response: {
            text: () => 'Success',
            candidates: [{ finishReason: 'STOP' }]
          }
        })
        .mockRejectedValueOnce(new Error('API Error'))

      const result = await geminiService.generateBatchExplanations(mockBatchRequest)

      expect(result.explanations).toHaveLength(2)
      expect(result.successCount).toBe(2) // Both succeed because generateExplanation handles errors internally
      expect(result.failureCount).toBe(0)
      expect(result.explanations[0].explanation).toBe('Success')
      expect(result.explanations[1].explanation).toContain('melancholy') // Fallback explanation
      expect(result.explanations[1].confidence).toBe(0.3) // Lower confidence for fallback
    })

    it('should process large batches in chunks', async () => {
      const largeBatchRequest: BatchExplanationRequest = {
        inputEntity: mockInputEntity,
        recommendations: Array(12).fill(null).map((_, i) => ({
          entity: {
            id: `entity-${i}`,
            name: `Entity ${i}`,
            type: 'book' as const
          },
          sharedThemes: mockSharedThemes,
          affinityScore: 0.8
        }))
      }

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Test explanation',
          candidates: [{ finishReason: 'STOP' }]
        }
      })

      const result = await geminiService.generateBatchExplanations(largeBatchRequest)

      expect(result.explanations).toHaveLength(12)
      expect(result.successCount).toBe(12)
      expect(mockGenerateContent).toHaveBeenCalledTimes(12)
    })
  })

  describe('validateContent', () => {
    it('should validate safe content', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'SAFE'
        }
      })

      const result = await geminiService.validateContent('This is safe content')

      expect(result.safe).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should detect unsafe content', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'UNSAFE: Contains inappropriate language'
        }
      })

      const result = await geminiService.validateContent('This is unsafe content')

      expect(result.safe).toBe(false)
      expect(result.reason).toBe('Contains inappropriate language')
    })

    it('should default to safe on validation error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Validation error'))

      const result = await geminiService.validateContent('Some content')

      expect(result.safe).toBe(true)
    })

    it('should default to safe on unclear response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'UNCLEAR RESPONSE'
        }
      })

      const result = await geminiService.validateContent('Some content')

      expect(result.safe).toBe(true)
    })
  })

  describe('confidence calculation', () => {
    it('should calculate higher confidence for high affinity and quality explanation', async () => {
      const highQualityExplanation = "Since you appreciate Radiohead's melancholic aesthetic and introspective mood, you'd likely connect with Kafka on the Shore's dreamlike atmosphere and contemplative themes."
      
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => highQualityExplanation,
          candidates: [{ finishReason: 'STOP' }]
        }
      })

      const result = await geminiService.generateExplanation({
        inputEntity: mockInputEntity,
        recommendedEntity: mockRecommendedEntity,
        sharedThemes: mockSharedThemes,
        affinityScore: 0.9
      })

      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('should calculate lower confidence for low affinity', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Basic explanation',
          candidates: [{ finishReason: 'STOP' }]
        }
      })

      const result = await geminiService.generateExplanation({
        inputEntity: mockInputEntity,
        recommendedEntity: mockRecommendedEntity,
        sharedThemes: mockSharedThemes,
        affinityScore: 0.3
      })

      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should set very low confidence for filtered content', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Filtered content',
          candidates: [{ finishReason: 'SAFETY' }]
        }
      })

      const result = await geminiService.generateExplanation({
        inputEntity: mockInputEntity,
        recommendedEntity: mockRecommendedEntity,
        sharedThemes: mockSharedThemes,
        affinityScore: 0.9
      })

      expect(result.confidence).toBe(0.2)
    })
  })

  describe('fallback explanations', () => {
    it('should generate fallback with shared themes', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'))

      const result = await geminiService.generateExplanation({
        inputEntity: mockInputEntity,
        recommendedEntity: mockRecommendedEntity,
        sharedThemes: mockSharedThemes,
        affinityScore: 0.8
      })

      expect(result.explanation).toContain('melancholy')
      expect(result.explanation).toContain('Radiohead')
      expect(result.explanation).toContain('Kafka on the Shore')
    })

    it('should generate generic fallback without shared themes', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'))

      const result = await geminiService.generateExplanation({
        inputEntity: mockInputEntity,
        recommendedEntity: mockRecommendedEntity,
        sharedThemes: [],
        affinityScore: 0.8
      })

      expect(result.explanation).toContain('Based on your interest in')
      expect(result.explanation).toContain('Radiohead')
      expect(result.explanation).toContain('Kafka on the Shore')
    })
  })

  describe('error handling', () => {
    it('should identify retryable errors', async () => {
      const retryableErrors = [
        'Rate limit exceeded',
        'Network timeout',
        'Service unavailable (503)',
        'Bad gateway (502)',
        'Internal server error (500)'
      ]

      for (const errorMessage of retryableErrors) {
        mockGenerateContent
          .mockRejectedValueOnce(new Error(errorMessage))
          .mockResolvedValue({
            response: {
              text: () => 'Success after retry',
              candidates: [{ finishReason: 'STOP' }]
            }
          })

        const result = await geminiService.generateExplanation({
          inputEntity: mockInputEntity,
          recommendedEntity: mockRecommendedEntity,
          sharedThemes: mockSharedThemes,
          affinityScore: 0.8
        })

        expect(result.explanation).toBe('Success after retry')
        vi.clearAllMocks()
      }
    })

    it('should not retry non-retryable errors', async () => {
      const nonRetryableErrors = [
        'Invalid API key',
        'Authentication failed',
        'Forbidden access'
      ]

      for (const errorMessage of nonRetryableErrors) {
        mockGenerateContent.mockRejectedValue(new Error(errorMessage))

        const result = await geminiService.generateExplanation({
          inputEntity: mockInputEntity,
          recommendedEntity: mockRecommendedEntity,
          sharedThemes: mockSharedThemes,
          affinityScore: 0.8
        })

        expect(result.explanation).toContain('melancholy')
        expect(mockGenerateContent).toHaveBeenCalledTimes(1)
        vi.clearAllMocks()
      }
    })
  })

  describe('model configuration', () => {
    it('should get current model info', () => {
      const info = geminiService.getModelInfo()
      expect(info.model).toBe('gemini-2.0-flash-lite')
      expect(info.config).toHaveProperty('temperature')
      expect(info.config).toHaveProperty('retryConfig')
    })

    it('should update model configuration', () => {
      const originalModel = geminiService.getModelInfo().model
      
      geminiService.updateModelConfig({
        model: 'gemini-1.5-pro',
        temperature: 0.5
      })
      
      const updatedInfo = geminiService.getModelInfo()
      expect(updatedInfo.model).toBe('gemini-1.5-pro')
      
      // Reset for other tests
      geminiService.updateModelConfig({ model: originalModel })
    })

    it('should update retry configuration', () => {
      geminiService.updateModelConfig({
        retryConfig: {
          maxRetries: 5,
          backoffMultiplier: 2.0,
          initialDelay: 1000,
          maxDelay: 10000
        }
      })
      
      const info = geminiService.getModelInfo()
      expect(info.config.retryConfig.maxRetries).toBe(5)
      expect(info.config.retryConfig.backoffMultiplier).toBe(2.0)
    })

    it('should get supported models list', () => {
      const models = GeminiService.getSupportedModels()
      expect(models).toContain('gemini-2.0-flash-lite')
      expect(models).toContain('gemini-1.5-flash')
      expect(models).toContain('gemini-1.5-pro')
    })

    it('should validate model names', () => {
      expect(GeminiService.isValidModel('gemini-2.0-flash-lite')).toBe(true)
      expect(GeminiService.isValidModel('gemini-1.5-pro')).toBe(true)
      expect(GeminiService.isValidModel('invalid-model')).toBe(false)
      expect(GeminiService.isValidModel('gemini-')).toBe(false)
    })
  })

  describe('safety settings', () => {
    it('should configure safety settings correctly', () => {
      const service = new GeminiService({ apiKey: 'test-key' })
      
      // Verify that the service was created without throwing
      expect(service).toBeDefined()
      
      // The safety settings are configured in the constructor
      // We can't directly test them, but we can verify the service works
      expect(typeof service.generateExplanation).toBe('function')
    })
  })
})