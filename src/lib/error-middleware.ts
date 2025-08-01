import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ErrorHandler, ErrorContext } from './error-handler'

/**
 * Higher-order function that wraps API route handlers with centralized error handling
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      // Add request context that can be accessed through the request object
      const context = { requestId, startTime }
      Object.defineProperty(request, 'context', { value: context, writable: false })
      
      // Add request ID to headers for tracking
      const response = await handler(request, ...args)
      
      // Handle undefined response
      if (!response) {
        throw new Error('API handler returned undefined response')
      }
      
      // Add standard headers to successful responses
      response.headers.set('X-Request-ID', requestId)
      response.headers.set('X-Processing-Time', (Date.now() - startTime).toString())
      
      return response
    } catch (error) {
      // Get user context for error logging
      let userId: string | undefined
      try {
        const authResult = await auth()
        userId = authResult.userId || undefined
      } catch (authError) {
        // Auth error - user context not available
        console.warn('[ErrorMiddleware] Could not get user context:', authError)
      }
      
      // Add rate limit information if present
      const rateLimitInfo: Record<string, any> = {}
      try {
        const rateLimitHeader = request.headers.get('X-RateLimit-Limit')
        if (rateLimitHeader) {
          rateLimitInfo.limit = rateLimitHeader
          rateLimitInfo.remaining = request.headers.get('X-RateLimit-Remaining') 
          rateLimitInfo.reset = request.headers.get('X-RateLimit-Reset')
        }
      } catch (headerError) {
        console.warn('[ErrorMiddleware] Error extracting rate limit headers:', headerError)
      }

      // Create error context
      const errorContext: ErrorContext = ErrorHandler.createErrorContext(
        request,
        requestId,
        userId,
        startTime,
        {
          args: args.length > 0 ? args : undefined
        }
      )

      // Handle error with centralized handler
      return await ErrorHandler.handleApiError(error, errorContext)
    }
  }
}

/**
 * Middleware for handling errors in API routes with graceful degradation
 */
export class ApiErrorMiddleware {
  /**
   * Wrap an API handler with error handling and graceful degradation
   */
  static withGracefulDegradation<T extends unknown[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
    fallbackHandler?: (error: unknown, request: NextRequest, ...args: T) => Promise<NextResponse>
  ) {
    return withErrorHandler(async (request: NextRequest, ...args: T) => {
      try {
        return await handler(request, ...args)
      } catch (error) {
        // If a fallback handler is provided and the error is from external services,
        // try the fallback before throwing
        if (fallbackHandler && ApiErrorMiddleware.isExternalServiceError(error)) {
          try {
            console.warn('[ApiErrorMiddleware] External service error, trying fallback:', error)
            return await fallbackHandler(error, request, ...args)
          } catch (fallbackError) {
            console.error('[ApiErrorMiddleware] Fallback also failed:', fallbackError)
            // Throw original error, not fallback error
            throw error
          }
        }
        
        throw error
      }
    })
  }

  /**
   * Check if error is from external services that might benefit from graceful degradation
   */
  private static isExternalServiceError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      const name = error.name.toLowerCase()
      
      return (
        // Service-specific errors
        name.includes('qlooserviceerror') ||
        name.includes('geminiserviceerror') ||
        // Network/timeout errors
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        // HTTP errors
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504')
      )
    }
    
    return false
  }

  /**
   * Create a fallback response for when external services are unavailable
   */
  static createFallbackResponse(
    requestId: string,
    message: string = 'Service temporarily unavailable. Please try again later.',
    statusCode: number = 503
  ): NextResponse {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message,
          details: {
            fallback: true,
            suggestion: 'This is a temporary issue. Please try again in a few minutes.'
          }
        },
        requestId,
        timestamp: new Date().toISOString()
      },
      { 
        status: statusCode,
        headers: {
          'X-Request-ID': requestId,
          'Retry-After': '300' // 5 minutes
        }
      }
    )
  }
}

/**
 * Utility for creating consistent error responses
 */
export class ErrorResponseUtils {
  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    code: string,
    message: string,
    statusCode: number,
    requestId: string,
    details?: Record<string, unknown>,
    retryAfter?: number
  ): NextResponse {
    const headers: Record<string, string> = {
      'X-Request-ID': requestId
    }
    
    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString()
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          details: details || {},
          retryAfter
        },
        requestId,
        timestamp: new Date().toISOString()
      },
      { 
        status: statusCode,
        headers
      }
    )
  }

  /**
   * Create a validation error response
   */
  static createValidationError(
    requestId: string,
    errors: Array<{ path: string; message: string; code?: string }>
  ): NextResponse {
    return this.createErrorResponse(
      'VALIDATION_ERROR',
      'Request validation failed',
      400,
      requestId,
      { errors }
    )
  }

  /**
   * Create an authentication error response
   */
  static createAuthError(requestId: string): NextResponse {
    return this.createErrorResponse(
      'UNAUTHORIZED',
      'Authentication required',
      401,
      requestId
    )
  }

  /**
   * Create a rate limit error response
   */
  static createRateLimitError(
    requestId: string,
    retryAfter: number,
    details?: Record<string, unknown>
  ): NextResponse {
    return this.createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded',
      429,
      requestId,
      details,
      retryAfter
    )
  }
}