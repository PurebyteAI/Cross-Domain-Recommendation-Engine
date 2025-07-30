import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { 
  AppError, 
  ErrorCode, 
  ErrorHandler, 
  ErrorUtils,
  ErrorContext 
} from '../error-handler'
import { QlooServiceError } from '@/services/qloo.service'
import { GeminiServiceError } from '@/services/gemini.service'

describe('AppError', () => {
  it('should create error with correct properties', () => {
    const error = new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Test error',
      400,
      { field: 'test' },
      true,
      60
    )

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(400)
    expect(error.details).toEqual({ field: 'test' })
    expect(error.isOperational).toBe(true)
    expect(error.retryAfter).toBe(60)
    expect(error.name).toBe('AppError')
  })

  it('should create error response object', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error', 500)
    const requestId = 'test-request-id'
    
    const response = error.toErrorResponse(requestId)

    expect(response.success).toBe(false)
    expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(response.error.message).toBe('Test error')
    expect(response.requestId).toBe(requestId)
    expect(response.timestamp).toBeDefined()
  })

  it('should identify retryable errors correctly', () => {
    const serverError = new AppError(ErrorCode.INTERNAL_ERROR, 'Server error', 500)
    const rateLimitError = new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limited', 429)
    const clientError = new AppError(ErrorCode.VALIDATION_ERROR, 'Bad request', 400)

    expect(serverError.isRetryable).toBe(true)
    expect(rateLimitError.isRetryable).toBe(true)
    expect(clientError.isRetryable).toBe(false)
  })

  it('should identify critical errors correctly', () => {
    const operationalError = new AppError(ErrorCode.VALIDATION_ERROR, 'Validation error', 400, {}, true)
    const nonOperationalError = new AppError(ErrorCode.CONFIGURATION_ERROR, 'Config error', 503, {}, false)
    const serverError = new AppError(ErrorCode.INTERNAL_ERROR, 'Server error', 500)

    expect(operationalError.isCritical).toBe(false)
    expect(nonOperationalError.isCritical).toBe(true)
    expect(serverError.isCritical).toBe(true)
  })
})

describe('ErrorHandler.normalizeError', () => {
  it('should return AppError as-is', () => {
    const originalError = new AppError(ErrorCode.VALIDATION_ERROR, 'Test error', 400)
    const normalized = ErrorHandler.normalizeError(originalError)

    expect(normalized).toBe(originalError)
  })

  it('should normalize ZodError', () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number'
      }
    ])

    const normalized = ErrorHandler.normalizeError(zodError)

    expect(normalized.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(normalized.statusCode).toBe(400)
    expect(normalized.details.errors).toHaveLength(1)
    expect(normalized.details.errors[0]).toEqual({
      path: 'name',
      message: 'Expected string, received number',
      code: 'invalid_type'
    })
  })

  it('should normalize QlooServiceError', () => {
    const qlooError = new QlooServiceError('Qloo API error', 500, 'searchEntity', { detail: 'test' })
    const normalized = ErrorHandler.normalizeError(qlooError)

    expect(normalized.code).toBe(ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE)
    expect(normalized.statusCode).toBe(500)
    expect(normalized.details.operation).toBe('searchEntity')
    expect(normalized.details.originalError).toEqual({ detail: 'test' })
  })

  it('should normalize QlooServiceError with rate limit', () => {
    const qlooError = new QlooServiceError('Rate limited', 429, 'searchEntity')
    const normalized = ErrorHandler.normalizeError(qlooError)

    expect(normalized.code).toBe(ErrorCode.QLOO_SERVICE_ERROR)
    expect(normalized.statusCode).toBe(429)
    expect(normalized.retryAfter).toBe(60)
  })

  it('should normalize GeminiServiceError', () => {
    const geminiError = new GeminiServiceError('Gemini API error', 503, 'generateExplanation')
    const normalized = ErrorHandler.normalizeError(geminiError)

    expect(normalized.code).toBe(ErrorCode.GEMINI_SERVICE_ERROR)
    expect(normalized.statusCode).toBe(503)
    expect(normalized.details.operation).toBe('generateExplanation')
  })

  it('should normalize timeout errors', () => {
    const timeoutError = new Error('Request timeout occurred')
    const normalized = ErrorHandler.normalizeError(timeoutError)

    expect(normalized.code).toBe(ErrorCode.REQUEST_TIMEOUT)
    expect(normalized.statusCode).toBe(408)
  })

  it('should normalize configuration errors', () => {
    const configError = new Error('API key not configured')
    const normalized = ErrorHandler.normalizeError(configError)

    expect(normalized.code).toBe(ErrorCode.CONFIGURATION_ERROR)
    expect(normalized.statusCode).toBe(503)
    expect(normalized.isOperational).toBe(false)
  })

  it('should normalize database errors', () => {
    const dbError = new Error('Database connection failed')
    const normalized = ErrorHandler.normalizeError(dbError)

    expect(normalized.code).toBe(ErrorCode.DATABASE_ERROR)
    expect(normalized.statusCode).toBe(503)
  })

  it('should normalize entity not found errors', () => {
    const notFoundError = new Error('Entity not found in database')
    const normalized = ErrorHandler.normalizeError(notFoundError)

    expect(normalized.code).toBe(ErrorCode.ENTITY_NOT_FOUND)
    expect(normalized.statusCode).toBe(404)
  })

  it('should normalize generic errors', () => {
    const genericError = new Error('Something went wrong')
    const normalized = ErrorHandler.normalizeError(genericError)

    expect(normalized.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(normalized.statusCode).toBe(500)
    expect(normalized.isOperational).toBe(false)
  })

  it('should normalize unknown error types', () => {
    const unknownError = 'string error'
    const normalized = ErrorHandler.normalizeError(unknownError)

    expect(normalized.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(normalized.statusCode).toBe(500)
    expect(normalized.details.originalError).toBe('string error')
  })
})

describe('ErrorHandler.createErrorContext', () => {
  it('should create error context from NextRequest', () => {
    const request = new NextRequest('https://example.com/api/test', {
      method: 'POST',
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1'
      }
    })

    const requestId = 'test-request-id'
    const userId = 'test-user-id'
    const startTime = Date.now() - 1000
    const metadata = { test: 'data' }

    const context = ErrorHandler.createErrorContext(
      request,
      requestId,
      userId,
      startTime,
      metadata
    )

    expect(context.requestId).toBe(requestId)
    expect(context.userId).toBe(userId)
    expect(context.endpoint).toBe('/api/test')
    expect(context.method).toBe('POST')
    expect(context.userAgent).toBe('test-agent')
    expect(context.ipAddress).toBe('192.168.1.1')
    expect(context.processingTime).toBeGreaterThan(0)
    expect(context.metadata).toEqual(metadata)
  })

  it('should handle missing headers gracefully', () => {
    const request = new NextRequest('https://example.com/api/test')
    const context = ErrorHandler.createErrorContext(request, 'test-id')

    expect(context.userAgent).toBeUndefined()
    expect(context.ipAddress).toBeUndefined()
    expect(context.userId).toBeUndefined()
  })
})

describe('ErrorHandler.handleApiError', () => {
  let mockLogError: any

  beforeEach(() => {
    mockLogError = vi.spyOn(ErrorHandler, 'logError').mockResolvedValue()
  })

  it('should handle API error and return proper response', async () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Test error', 400, { field: 'test' })
    const context: ErrorContext = {
      requestId: 'test-request-id',
      endpoint: '/api/test',
      method: 'POST',
      timestamp: new Date(),
      processingTime: 100
    }

    const response = await ErrorHandler.handleApiError(error, context)
    const responseData = await response.json()

    expect(response.status).toBe(400)
    expect(responseData.success).toBe(false)
    expect(responseData.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(responseData.error.message).toBe('Test error')
    expect(responseData.requestId).toBe('test-request-id')
    expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    expect(response.headers.get('X-Processing-Time')).toBe('100')

    expect(mockLogError).toHaveBeenCalledWith(error, context)
  })

  it('should include retry-after header for retryable errors', async () => {
    const error = new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limited', 429, {}, true, 60)
    const context: ErrorContext = {
      requestId: 'test-request-id',
      endpoint: '/api/test',
      method: 'POST',
      timestamp: new Date(),
      processingTime: 100
    }

    const response = await ErrorHandler.handleApiError(error, context)

    expect(response.headers.get('Retry-After')).toBe('60')
  })
})

describe('ErrorUtils', () => {
  it('should create authentication required error', () => {
    const error = ErrorUtils.authenticationRequired()

    expect(error.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(error.statusCode).toBe(401)
    expect(error.message).toBe('Authentication required')
  })

  it('should create user not found error', () => {
    const error = ErrorUtils.userNotFound()

    expect(error.code).toBe(ErrorCode.USER_NOT_FOUND)
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('User profile not found')
  })

  it('should create validation error', () => {
    const details = { field: 'name', issue: 'required' }
    const error = ErrorUtils.validationError('Validation failed', details)

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(error.statusCode).toBe(400)
    expect(error.message).toBe('Validation failed')
    expect(error.details).toEqual(details)
  })

  it('should create rate limit exceeded error', () => {
    const details = { limit: 100, remaining: 0 }
    const error = ErrorUtils.rateLimitExceeded(60, details)

    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
    expect(error.statusCode).toBe(429)
    expect(error.retryAfter).toBe(60)
    expect(error.details).toEqual(details)
  })

  it('should create usage limit exceeded error', () => {
    const details = { tier: 'free', limit: 100 }
    const error = ErrorUtils.usageLimitExceeded(details)

    expect(error.code).toBe(ErrorCode.USAGE_LIMIT_EXCEEDED)
    expect(error.statusCode).toBe(429)
    expect(error.details).toEqual(details)
  })

  it('should create service unavailable error', () => {
    const error = ErrorUtils.serviceUnavailable('Qloo')

    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE)
    expect(error.statusCode).toBe(503)
    expect(error.message).toBe('Qloo service is temporarily unavailable')
  })

  it('should create entity not found error', () => {
    const error = ErrorUtils.entityNotFound('User', 'user-123')

    expect(error.code).toBe(ErrorCode.ENTITY_NOT_FOUND)
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('User not found')
    expect(error.details).toEqual({ entityType: 'User', identifier: 'user-123' })
  })

  it('should create configuration error', () => {
    const error = ErrorUtils.configurationError('API key missing')

    expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR)
    expect(error.statusCode).toBe(503)
    expect(error.message).toBe('API key missing')
    expect(error.isOperational).toBe(false)
  })
})