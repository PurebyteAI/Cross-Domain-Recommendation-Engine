import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ErrorResponse } from '@/types'
import { QlooServiceError } from '@/services/qloo.service'
import { GeminiServiceError } from '@/services/gemini.service'

/**
 * Standard error codes used throughout the application
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  
  // Request Validation
  INVALID_JSON = 'INVALID_JSON',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Rate Limiting & Usage
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // External Services
  QLOO_SERVICE_ERROR = 'QLOO_SERVICE_ERROR',
  GEMINI_SERVICE_ERROR = 'GEMINI_SERVICE_ERROR',
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE',
  
  // Data & Resources
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DATA_PROCESSING_ERROR = 'DATA_PROCESSING_ERROR',
  
  // System & Infrastructure
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  
  // Configuration
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  API_KEY_INVALID = 'API_KEY_INVALID',
  FEATURE_DISABLED = 'FEATURE_DISABLED'
}

/**
 * Application error class with structured information
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details: Record<string, unknown> = {},
    public readonly isOperational: boolean = true,
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = 'AppError'
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  /**
   * Create error response object
   */
  toErrorResponse(requestId: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        retryAfter: this.retryAfter
      },
      requestId,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Check if error is retryable
   */
  get isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429
  }

  /**
   * Check if error should be logged as critical
   */
  get isCritical(): boolean {
    return !this.isOperational || this.statusCode >= 500
  }
}

/**
 * Error context for logging and monitoring
 */
export interface ErrorContext {
  requestId: string
  userId?: string
  endpoint: string
  method: string
  userAgent?: string
  ipAddress?: string
  timestamp: Date
  processingTime: number
  metadata?: Record<string, unknown>
}

/**
 * Centralized error handler for API routes
 */
export class ErrorHandler {
  /**
   * Handle errors in API routes with proper logging and response formatting
   */
  static async handleApiError(
    error: unknown,
    context: ErrorContext
  ): Promise<NextResponse<ErrorResponse>> {
    // Normalize error before any other processing
    const appError = this.normalizeError(error)
    
    try {
      // Log error with context
      await this.logError(appError, context)
    } catch (loggingError) {
      console.error('Failed to log error properly:', loggingError);
      // Continue despite logging failure - user experience is more important
    }
    
    try {
      // Create error response
      const errorResponse = appError.toErrorResponse(context.requestId)
      
      // Add response headers
      const headers: Record<string, string> = {
        'X-Request-ID': context.requestId,
        'X-Processing-Time': context.processingTime.toString(),
        'X-Error-Code': appError.code
      }
      
      if (appError.retryAfter) {
        headers['Retry-After'] = appError.retryAfter.toString()
      }
      
      // Include CORS headers for API responses
      // Use a generic approach since we don't have direct request access here
      headers['Access-Control-Allow-Origin'] = '*'
      headers['Access-Control-Expose-Headers'] = 'X-Request-ID, X-Processing-Time, X-Error-Code, Retry-After'
      
      return NextResponse.json(errorResponse, {
        status: appError.statusCode,
        headers
      })
    } catch (responseError) {
      // Last resort fallback if error response creation fails
      console.error('Failed to create proper error response:', responseError);
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred while processing the error response'
          },
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  }

  /**
   * Normalize different error types into AppError
   */
  static normalizeError(error: unknown): AppError {
    // Already an AppError
    if (error instanceof AppError) {
      return error
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Request validation failed',
        400,
        {
          errors: error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        }
      )
    }

    // Qloo service errors
    if (error instanceof QlooServiceError) {
      const code = error.isClientError 
        ? ErrorCode.QLOO_SERVICE_ERROR 
        : ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE
      
      return new AppError(
        code,
        `Qloo API error: ${error.message}`,
        error.statusCode,
        {
          operation: error.operation,
          originalError: error.details,
          isRetryable: error.isRetryable
        },
        true,
        error.isRateLimit ? 60 : undefined
      )
    }

    // Gemini service errors
    if (error instanceof GeminiServiceError) {
      return new AppError(
        ErrorCode.GEMINI_SERVICE_ERROR,
        `Gemini API error: ${error.message}`,
        error.statusCode,
        {
          operation: error.operation,
          originalError: error.details,
          isRetryable: error.isRetryable
        },
        true,
        error.isRateLimit ? 60 : undefined
      )
    }

    // Standard JavaScript errors
    if (error instanceof Error) {
      // Timeout errors
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        return new AppError(
          ErrorCode.REQUEST_TIMEOUT,
          'Request timed out. Please try again.',
          408,
          { originalError: error.message }
        )
      }

      // Configuration errors
      if (error.message.includes('API key') || error.message.includes('not configured')) {
        return new AppError(
          ErrorCode.CONFIGURATION_ERROR,
          'Service configuration error',
          503,
          { originalError: error.message },
          false
        )
      }

      // Entity not found errors (check before database errors)
      if (error.message.includes('not found') || error.message.includes('NOT_FOUND')) {
        return new AppError(
          ErrorCode.ENTITY_NOT_FOUND,
          'Requested resource not found',
          404,
          { originalError: error.message }
        )
      }

      // Database errors
      if (error.message.includes('database') || error.message.includes('connection')) {
        return new AppError(
          ErrorCode.DATABASE_ERROR,
          'Database operation failed',
          503,
          { originalError: error.message }
        )
      }

      // Generic error
      return new AppError(
        ErrorCode.INTERNAL_ERROR,
        'An internal error occurred',
        500,
        { originalError: error.message },
        false
      )
    }

    // Unknown error type
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred',
      500,
      { originalError: String(error) },
      false
    )
  }

  /**
   * Log error with structured information
   */
  static async logError(error: AppError, context: ErrorContext): Promise<void> {
    const logLevel = error.isCritical ? 'error' : 'warn'
    
    // Use the new LoggingService for structured logging
    try {
      const { LoggingService } = await import('@/services/logging.service')
      
      if (logLevel === 'error') {
        LoggingService.error(error.message, new Error(error.stack), {
          service: 'error-handler',
          operation: 'handle_error',
          userId: context.userId,
          requestId: context.requestId,
          endpoint: context.endpoint,
          method: context.method,
          statusCode: error.statusCode,
          responseTime: context.processingTime,
          metadata: {
            errorCode: error.code,
            isOperational: error.isOperational,
            isRetryable: error.isRetryable,
            details: error.details,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
            ...context.metadata
          }
        })
      } else {
        LoggingService.warn(error.message, {
          service: 'error-handler',
          operation: 'handle_error',
          userId: context.userId,
          requestId: context.requestId,
          endpoint: context.endpoint,
          method: context.method,
          statusCode: error.statusCode,
          responseTime: context.processingTime,
          metadata: {
            errorCode: error.code,
            isOperational: error.isOperational,
            isRetryable: error.isRetryable,
            details: error.details,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
            ...context.metadata
          }
        })
      }

      // Record error metrics
      LoggingService.metrics([
        {
          name: 'error_count',
          value: 1,
          tags: {
            error_code: error.code,
            status_code: error.statusCode.toString(),
            endpoint: context.endpoint,
            method: context.method,
            is_operational: error.isOperational.toString(),
            is_retryable: error.isRetryable.toString()
          }
        },
        {
          name: 'response_time',
          value: context.processingTime,
          unit: 'ms',
          tags: {
            endpoint: context.endpoint,
            method: context.method,
            status_code: error.statusCode.toString()
          }
        }
      ])

    } catch (loggingError) {
      // Fallback to console logging if LoggingService fails
      console.error('[ErrorHandler] Failed to use LoggingService, falling back to console:', loggingError)
      
      const logData = {
        level: logLevel,
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          isOperational: error.isOperational,
          isRetryable: error.isRetryable,
          stack: error.stack
        },
        context: {
          requestId: context.requestId,
          userId: context.userId,
          endpoint: context.endpoint,
          method: context.method,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          timestamp: context.timestamp.toISOString(),
          processingTime: context.processingTime,
          metadata: context.metadata
        },
        details: error.details
      }

      if (logLevel === 'error') {
        console.error('[ErrorHandler] Critical error:', JSON.stringify(logData, null, 2))
      } else {
        console.warn('[ErrorHandler] Operational error:', JSON.stringify(logData, null, 2))
      }

      // Try legacy logging method
      try {
        await this.sendToLoggingService(logData)
      } catch (legacyError) {
        console.error('[ErrorHandler] Failed to send error to legacy logging service:', legacyError)
      }
    }
  }

  /**
   * Send error data to logging service
   */
  private static async sendToLoggingService(logData: any): Promise<void> {
    try {
      // Import Supabase client dynamically to avoid circular dependencies
      const { supabase } = await import('@/lib/supabase')
      
      // Extract relevant data for structured logging
      const logEntry = {
        level: logData.level,
        error_code: logData.error.code,
        error_message: logData.error.message,
        status_code: logData.error.statusCode,
        is_operational: logData.error.isOperational,
        is_retryable: logData.error.isRetryable,
        request_id: logData.context.requestId,
        user_id: logData.context.userId,
        endpoint: logData.context.endpoint,
        method: logData.context.method,
        user_agent: logData.context.userAgent,
        ip_address: logData.context.ipAddress,
        processing_time: logData.context.processingTime,
        error_details: logData.details,
        context_metadata: logData.context.metadata,
        stack_trace: logData.error.stack,
        timestamp: logData.context.timestamp
      }

      // Insert error log into Supabase
      const { error } = await supabase
        .from('error_logs')
        .insert(logEntry)

      if (error) {
        console.error('[ErrorHandler] Failed to log error to Supabase:', error)
        // Don't throw here to avoid recursive error logging
      }
    } catch (error) {
      console.error('[ErrorHandler] Error in sendToLoggingService:', error)
      // Don't throw here to avoid recursive error logging
    }
  }

  /**
   * Create error context from Next.js request
   */
  static createErrorContext(
    request: NextRequest,
    requestId: string,
    userId?: string,
    startTime?: number,
    metadata?: Record<string, unknown>
  ): ErrorContext {
    const now = Date.now()
    const additionalMetadata: Record<string, unknown> = { ...metadata }
    
    try {
      // Extract query parameters
      const queryParams: Record<string, string> = {}
      request.nextUrl.searchParams.forEach((value, key) => {
        queryParams[key] = value
      })
      
      if (Object.keys(queryParams).length > 0) {
        additionalMetadata.queryParams = queryParams
      }
      
      // Extract headers that might be useful for debugging
      const relevantHeaders: Record<string, string> = {}
      const headerNames = [
        'accept', 
        'content-type', 
        'user-agent', 
        'referer', 
        'origin',
        'x-request-id',
        'x-correlation-id'
      ]
      
      headerNames.forEach(name => {
        const value = request.headers.get(name)
        if (value) {
          relevantHeaders[name] = value
        }
      })
      
      if (Object.keys(relevantHeaders).length > 0) {
        additionalMetadata.headers = relevantHeaders
      }
      
    } catch (metadataError) {
      console.warn('[ErrorHandler] Error extracting request metadata:', metadataError)
    }
    
    return {
      requestId,
      userId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 undefined,
      timestamp: new Date(),
      processingTime: startTime ? now - startTime : 0,
      metadata: additionalMetadata
    }
  }
}

/**
 * Utility functions for common error scenarios
 */
export class ErrorUtils {
  /**
   * Create authentication required error
   */
  static authenticationRequired(): AppError {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      'Authentication required',
      401
    )
  }

  /**
   * Create user not found error
   */
  static userNotFound(): AppError {
    return new AppError(
      ErrorCode.USER_NOT_FOUND,
      'User profile not found',
      404
    )
  }

  /**
   * Create validation error
   */
  static validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      details
    )
  }

  /**
   * Create rate limit exceeded error
   */
  static rateLimitExceeded(retryAfter: number, details?: Record<string, unknown>): AppError {
    return new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      429,
      details,
      true,
      retryAfter
    )
  }

  /**
   * Create usage limit exceeded error
   */
  static usageLimitExceeded(details?: Record<string, unknown>): AppError {
    return new AppError(
      ErrorCode.USAGE_LIMIT_EXCEEDED,
      'Daily usage limit exceeded for your tier',
      429,
      details
    )
  }

  /**
   * Create service unavailable error
   */
  static serviceUnavailable(service: string): AppError {
    return new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} service is temporarily unavailable`,
      503
    )
  }

  /**
   * Create entity not found error
   */
  static entityNotFound(entityType: string, identifier: string): AppError {
    return new AppError(
      ErrorCode.ENTITY_NOT_FOUND,
      `${entityType} not found`,
      404,
      { entityType, identifier }
    )
  }

  /**
   * Create configuration error
   */
  static configurationError(message: string): AppError {
    return new AppError(
      ErrorCode.CONFIGURATION_ERROR,
      message,
      503,
      {},
      false
    )
  }
}