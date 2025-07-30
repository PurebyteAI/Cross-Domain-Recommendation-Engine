import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { 
  withErrorHandler, 
  ApiErrorMiddleware, 
  ErrorResponseUtils 
} from '../error-middleware'
import { AppError, ErrorCode } from '../error-handler'
import { QlooServiceError } from '@/services/qloo.service'
import { GeminiServiceError } from '@/services/gemini.service'

// Mock auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn()
}))

// Mock ErrorHandler
vi.mock('../error-handler', async () => {
  const actual = await vi.importActual('../error-handler')
  return {
    ...actual,
    ErrorHandler: {
      ...actual.ErrorHandler,
      handleApiError: vi.fn(),
      createErrorContext: vi.fn()
    }
  }
})

import { auth } from '@clerk/nextjs/server'
import { ErrorHandler } from '../error-handler'

const mockAuth = vi.mocked(auth)
const mockHandleApiError = vi.mocked(ErrorHandler.handleApiError)
const mockCreateErrorContext = vi.mocked(ErrorHandler.createErrorContext)

describe('withErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'test-user-id' })
    mockCreateErrorContext.mockReturnValue({
      requestId: 'test-request-id',
      endpoint: '/api/test',
      method: 'POST',
      timestamp: new Date(),
      processingTime: 100
    })
  })

  it('should wrap handler and add standard headers on success', async () => {
    const mockHandler = vi.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    )
    const wrappedHandler = withErrorHandler(mockHandler)
    
    const request = new NextRequest('https://example.com/api/test', { method: 'POST' })
    const response = await wrappedHandler(request)

    expect(mockHandler).toHaveBeenCalledWith(request)
    expect(response.headers.get('X-Request-ID')).toBeDefined()
    expect(response.headers.get('X-Processing-Time')).toBeDefined()
  })

  it('should handle errors with centralized error handler', async () => {
    const error = new Error('Test error')
    const mockHandler = vi.fn().mockRejectedValue(error)
    const mockErrorResponse = NextResponse.json({ error: 'handled' }, { status: 500 })
    
    mockHandleApiError.mockResolvedValue(mockErrorResponse)
    
    const wrappedHandler = withErrorHandler(mockHandler)
    const request = new NextRequest('https://example.com/api/test', { method: 'POST' })
    
    const response = await wrappedHandler(request)

    expect(mockHandleApiError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        requestId: expect.any(String),
        endpoint: '/api/test',
        method: 'POST'
      })
    )
    expect(response).toBe(mockErrorResponse)
  })

  it('should handle auth errors gracefully', async () => {
    mockAuth.mockRejectedValue(new Error('Auth failed'))
    
    const error = new Error('Test error')
    const mockHandler = vi.fn().mockRejectedValue(error)
    const mockErrorResponse = NextResponse.json({ error: 'handled' }, { status: 500 })
    
    mockHandleApiError.mockResolvedValue(mockErrorResponse)
    
    const wrappedHandler = withErrorHandler(mockHandler)
    const request = new NextRequest('https://example.com/api/test', { method: 'POST' })
    
    const response = await wrappedHandler(request)

    expect(mockCreateErrorContext).toHaveBeenCalledWith(
      request,
      expect.any(String),
      undefined, // userId should be undefined due to auth error
      expect.any(Number),
      expect.any(Object)
    )
  })

  it('should pass additional arguments to handler', async () => {
    const mockHandler = vi.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    )
    const wrappedHandler = withErrorHandler(mockHandler)
    
    const request = new NextRequest('https://example.com/api/test')
    const additionalArg = { context: 'test' }
    
    await wrappedHandler(request, additionalArg)

    expect(mockHandler).toHaveBeenCalledWith(request, additionalArg)
  })
})

describe('ApiErrorMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'test-user-id' })
  })

  describe('withGracefulDegradation', () => {
    it('should call main handler when no error occurs', async () => {
      const mockResponse = NextResponse.json({ success: true })
      const mockHandler = vi.fn().mockResolvedValue(mockResponse)
      const mockFallback = vi.fn()
      
      const wrappedHandler = ApiErrorMiddleware.withGracefulDegradation(
        mockHandler,
        mockFallback
      )
      
      const request = new NextRequest('https://example.com/api/test')
      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(mockFallback).not.toHaveBeenCalled()
      expect(response.headers.get('X-Request-ID')).toBeDefined()
    })

    it('should call fallback for external service errors', async () => {
      const serviceError = new QlooServiceError('Service unavailable', 503, 'test')
      const mockHandler = vi.fn().mockRejectedValue(serviceError)
      const mockFallbackResponse = NextResponse.json({ fallback: true }, { status: 503 })
      const mockFallback = vi.fn().mockResolvedValue(mockFallbackResponse)
      
      const wrappedHandler = ApiErrorMiddleware.withGracefulDegradation(
        mockHandler,
        mockFallback
      )
      
      const request = new NextRequest('https://example.com/api/test')
      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(mockFallback).toHaveBeenCalledWith(serviceError, request)
      expect(response).toBe(mockFallbackResponse)
    })

    it('should throw original error if fallback fails', async () => {
      const originalError = new GeminiServiceError('Service error', 500, 'test')
      const fallbackError = new Error('Fallback failed')
      
      const mockHandler = vi.fn().mockRejectedValue(originalError)
      const mockFallback = vi.fn().mockRejectedValue(fallbackError)
      const mockErrorResponse = NextResponse.json({ error: 'handled' }, { status: 500 })
      
      mockHandleApiError.mockResolvedValue(mockErrorResponse)
      
      const wrappedHandler = ApiErrorMiddleware.withGracefulDegradation(
        mockHandler,
        mockFallback
      )
      
      const request = new NextRequest('https://example.com/api/test')
      const response = await wrappedHandler(request)

      expect(mockFallback).toHaveBeenCalled()
      expect(mockHandleApiError).toHaveBeenCalledWith(
        originalError, // Should be original error, not fallback error
        expect.any(Object)
      )
    })

    it('should not call fallback for non-external service errors', async () => {
      const validationError = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input', 400)
      const mockHandler = vi.fn().mockRejectedValue(validationError)
      const mockFallback = vi.fn()
      const mockErrorResponse = NextResponse.json({ error: 'handled' }, { status: 400 })
      
      mockHandleApiError.mockResolvedValue(mockErrorResponse)
      
      const wrappedHandler = ApiErrorMiddleware.withGracefulDegradation(
        mockHandler,
        mockFallback
      )
      
      const request = new NextRequest('https://example.com/api/test')
      await wrappedHandler(request)

      expect(mockFallback).not.toHaveBeenCalled()
      expect(mockHandleApiError).toHaveBeenCalledWith(validationError, expect.any(Object))
    })
  })

  describe('isExternalServiceError', () => {
    const isExternalServiceError = (ApiErrorMiddleware as any).isExternalServiceError

    it('should identify service-specific errors', () => {
      const qlooError = new QlooServiceError('Error', 500, 'test')
      const geminiError = new GeminiServiceError('Error', 500, 'test')
      
      expect(isExternalServiceError(qlooError)).toBe(true)
      expect(isExternalServiceError(geminiError)).toBe(true)
    })

    it('should identify network errors', () => {
      const timeoutError = new Error('Request timeout')
      const networkError = new Error('Network connection failed')
      const connectionError = new Error('ECONNREFUSED')
      const notFoundError = new Error('ENOTFOUND')
      
      expect(isExternalServiceError(timeoutError)).toBe(true)
      expect(isExternalServiceError(networkError)).toBe(true)
      expect(isExternalServiceError(connectionError)).toBe(true)
      expect(isExternalServiceError(notFoundError)).toBe(true)
    })

    it('should identify HTTP server errors', () => {
      const badGatewayError = new Error('502 Bad Gateway')
      const serviceUnavailableError = new Error('503 Service Unavailable')
      const gatewayTimeoutError = new Error('504 Gateway Timeout')
      
      expect(isExternalServiceError(badGatewayError)).toBe(true)
      expect(isExternalServiceError(serviceUnavailableError)).toBe(true)
      expect(isExternalServiceError(gatewayTimeoutError)).toBe(true)
    })

    it('should not identify non-external service errors', () => {
      const validationError = new Error('Validation failed')
      const authError = new Error('Unauthorized')
      const appError = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid', 400)
      
      expect(isExternalServiceError(validationError)).toBe(false)
      expect(isExternalServiceError(authError)).toBe(false)
      expect(isExternalServiceError(appError)).toBe(false)
    })

    it('should handle non-Error objects', () => {
      expect(isExternalServiceError('string error')).toBe(false)
      expect(isExternalServiceError(null)).toBe(false)
      expect(isExternalServiceError(undefined)).toBe(false)
    })
  })

  describe('createFallbackResponse', () => {
    it('should create fallback response with default values', () => {
      const requestId = 'test-request-id'
      const response = ApiErrorMiddleware.createFallbackResponse(requestId)

      expect(response.status).toBe(503)
      expect(response.headers.get('X-Request-ID')).toBe(requestId)
      expect(response.headers.get('Retry-After')).toBe('300')
    })

    it('should create fallback response with custom values', () => {
      const requestId = 'test-request-id'
      const message = 'Custom fallback message'
      const statusCode = 502
      
      const response = ApiErrorMiddleware.createFallbackResponse(
        requestId,
        message,
        statusCode
      )

      expect(response.status).toBe(statusCode)
      expect(response.headers.get('X-Request-ID')).toBe(requestId)
    })
  })
})

describe('ErrorResponseUtils', () => {
  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const response = ErrorResponseUtils.createErrorResponse(
        'TEST_ERROR',
        'Test error message',
        400,
        'test-request-id',
        { field: 'test' },
        60
      )

      expect(response.status).toBe(400)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
      expect(response.headers.get('Retry-After')).toBe('60')
    })

    it('should create error response without retry-after', () => {
      const response = ErrorResponseUtils.createErrorResponse(
        'TEST_ERROR',
        'Test error message',
        400,
        'test-request-id'
      )

      expect(response.status).toBe(400)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
      expect(response.headers.get('Retry-After')).toBeNull()
    })
  })

  describe('createValidationError', () => {
    it('should create validation error response', () => {
      const errors = [
        { path: 'name', message: 'Required field' },
        { path: 'email', message: 'Invalid format', code: 'invalid_email' }
      ]
      
      const response = ErrorResponseUtils.createValidationError('test-request-id', errors)

      expect(response.status).toBe(400)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })
  })

  describe('createAuthError', () => {
    it('should create authentication error response', () => {
      const response = ErrorResponseUtils.createAuthError('test-request-id')

      expect(response.status).toBe(401)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })
  })

  describe('createRateLimitError', () => {
    it('should create rate limit error response', () => {
      const details = { limit: 100, remaining: 0 }
      const response = ErrorResponseUtils.createRateLimitError(
        'test-request-id',
        60,
        details
      )

      expect(response.status).toBe(429)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
      expect(response.headers.get('Retry-After')).toBe('60')
    })
  })
})