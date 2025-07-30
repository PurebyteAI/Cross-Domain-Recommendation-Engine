import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Security configuration
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none',
} as const

// CORS configuration
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  'Access-Control-Max-Age': '86400', // 24 hours
} as const

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/user(.*)',
  '/api/v1(.*)',
])

const isPublicApiRoute = createRouteMatcher([
  '/api/webhooks(.*)',
  '/api/health(.*)',
  '/api/docs(.*)',
])

const isRateLimitedRoute = createRouteMatcher([
  '/api/v1(.*)',
  '/api/user(.*)',
])

const isAdminRoute = createRouteMatcher([
  '/api/admin(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const startTime = Date.now()
  
  // Apply security headers to all responses
  const response = NextResponse.next()
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Handle CORS for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin')
    const allowedOrigins = getAllowedOrigins()
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    } else if (process.env.NODE_ENV === 'development') {
      response.headers.set('Access-Control-Allow-Origin', '*')
    }
    
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers })
    }
  }
  
  // Allow public API routes without authentication
  if (isPublicApiRoute(req)) {
    return response
  }

  // Enhanced security for admin routes
  if (isAdminRoute(req)) {
    try {
      const { userId } = await auth()
      if (!userId) {
        return NextResponse.json(
          { 
            success: false,
            error: { 
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for admin access' 
            }
          },
          { status: 401 }
        )
      }
      
      // Check admin privileges
      const isAdmin = await checkAdminPrivileges(userId)
      if (!isAdmin) {
        // Log unauthorized admin access attempt
        await logSecurityEvent({
          userId,
          event: 'unauthorized_admin_access',
          details: { path: req.nextUrl.pathname },
          ip: getClientIP(req),
          userAgent: req.headers.get('user-agent') || '',
          timestamp: new Date().toISOString()
        })
        
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_PRIVILEGES',
              message: 'Admin access required'
            }
          },
          { status: 403 }
        )
      }
    } catch (error) {
      console.error('Admin route protection error:', error)
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'AUTHENTICATION_ERROR',
            message: 'Authentication verification failed' 
          }
        },
        { status: 500 }
      )
    }
  }

  // Protect authenticated routes
  if (isProtectedRoute(req)) {
    try {
      await auth.protect()
    } catch (error) {
      // For API routes, return JSON error response
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      // For web routes, let Clerk handle the redirect
      throw error
    }
  }

  // Apply rate limiting to API routes
  if (isRateLimitedRoute(req)) {
    try {
      const { userId } = await auth()
      
      if (userId) {
        // Dynamically import services to avoid client-side bundling issues
        const { RateLimiterService } = await import('@/services/rate-limiter.service')

        // Check rate limit with error handling
        let rateLimitResult
        try {
          rateLimitResult = await RateLimiterService.checkRateLimit(
            userId,
            req.nextUrl.pathname
          )
        } catch (rateLimitError) {
          console.error('Rate limit check failed:', rateLimitError)
          // Allow request if rate limiting fails
          return NextResponse.next()
        }

        if (!rateLimitResult.allowed) {
          // Try to track the rate-limited request, but don't fail if it errors
          try {
            const { UsageTrackingService } = await import('@/services/usage-tracking.service')
            const responseTime = Date.now() - startTime
            await UsageTrackingService.trackRequest({
              clerkUserId: userId,
              endpoint: req.nextUrl.pathname,
              method: req.method,
              statusCode: 429,
              responseTimeMs: responseTime,
              userAgent: req.headers.get('user-agent') || undefined,
              ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
            })
          } catch (trackingError) {
            console.error('Failed to track rate-limited request:', trackingError)
          }

          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              limit: rateLimitResult.limit,
              remaining: rateLimitResult.remaining,
              resetTime: rateLimitResult.resetTime,
              retryAfter: rateLimitResult.retryAfter,
              tier: rateLimitResult.tier,
            },
            { 
              status: 429,
              headers: {
                'X-RateLimit-Limit': rateLimitResult.limit.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
                'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
              }
            }
          )
        }

        // Record the request (will be incremented after successful processing)
        try {
          await RateLimiterService.recordRequest(userId, req.nextUrl.pathname)
        } catch (recordError) {
          console.error('Failed to record request:', recordError)
          // Continue anyway
        }

        // Add rate limit headers to response
        const response = NextResponse.next()
        response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
        response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
        
        return response
      }
    } catch (error) {
      console.error('Rate limiting middleware error:', error)
      // Continue without rate limiting if there's an error
    }
  }

  // Check for suspicious activity
  try {
    const { userId } = await auth()
    if (userId) {
      const suspiciousActivity = await detectSuspiciousActivity(req, userId)
      if (suspiciousActivity) {
        await logSecurityEvent({
          userId,
          event: 'suspicious_activity',
          details: suspiciousActivity,
          ip: getClientIP(req),
          userAgent: req.headers.get('user-agent') || '',
          timestamp: new Date().toISOString()
        })
      }
      
      // Add user context headers for API routes
      if (req.nextUrl.pathname.startsWith('/api/')) {
        response.headers.set('X-User-ID', userId)
      }
    }
  } catch (error) {
    // Continue without user context if auth fails
  }

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

// Helper functions

function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS?.split(',') || []
  
  // Add default allowed origins
  const defaultOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://localhost:3000',
    'http://localhost:3000'
  ].filter(Boolean) as string[]
  
  return [...new Set([...origins, ...defaultOrigins])]
}

async function checkAdminPrivileges(userId: string): Promise<boolean> {
  try {
    // Check if user has admin role in your system
    const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || []
    return adminUsers.includes(userId)
  } catch (error) {
    console.error('Error checking admin privileges:', error)
    return false
  }
}

async function detectSuspiciousActivity(req: NextRequest, userId: string): Promise<string | null> {
  try {
    const userAgent = req.headers.get('user-agent') || ''
    const ip = getClientIP(req)
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      // Bot-like user agents
      /bot|crawler|spider|scraper/i,
      // Suspicious tools (but allow legitimate testing tools in development)
      ...(process.env.NODE_ENV === 'production' ? [/curl|wget|postman|insomnia/i] : []),
      // Empty or very short user agents
      /^.{0,10}$/
    ]
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      return `Suspicious user agent: ${userAgent}`
    }
    
    // Check for unusual request patterns
    const path = req.nextUrl.pathname
    if (path.includes('..') || path.includes('<script>') || path.includes('javascript:')) {
      return `Suspicious path: ${path}`
    }
    
    return null
  } catch (error) {
    console.error('Error detecting suspicious activity:', error)
    return null
  }
}

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0].trim()
  
  return 'unknown'
}

async function logSecurityEvent(event: {
  userId: string
  event: string
  details: any
  ip: string
  userAgent: string
  timestamp: string
}): Promise<void> {
  try {
    // Log to console for immediate visibility
    console.warn('Security event:', event)
    
    // Store in database for analysis
    if (typeof window === 'undefined') {
      const { SystemMetricsService } = await import('@/lib/database')
      await SystemMetricsService.record({
        metric_name: 'security_event',
        metric_value: 1,
        tags: event
      })
    }
  } catch (error) {
    console.error('Error logging security event:', error)
  }
}