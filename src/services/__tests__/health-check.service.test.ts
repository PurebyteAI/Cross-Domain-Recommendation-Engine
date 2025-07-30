import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { HealthCheckService } from '../health-check.service'

// Mock dependencies
vi.mock('../cached-qloo.service', () => ({
  createCachedQlooService: vi.fn(() => ({
    getCacheStats: vi.fn().mockResolvedValue({
      l1Size: 10,
      l2Connected: true
    }),
    searchEntity: vi.fn().mockResolvedValue([
      { id: '1', name: 'Radiohead', type: 'artist' }
    ])
  }))
}))

vi.mock('../gemini.service', () => ({
  GeminiService: vi.fn().mockImplementation(() => ({
    getModelInfo: vi.fn().mockReturnValue({
      model: 'gemini-1.5-flash',
      config: { temperature: 0.7 }
    }),
    generateExplanation: vi.fn().mockResolvedValue({
      explanation: 'Test explanation'
    })
  }))
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ error: null })
        }))
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null })
      }))
    }))
  }
}))

vi.mock('../logging.service', () => ({
  LoggingService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    metrics: vi.fn(),
    getMetrics: vi.fn().mockResolvedValue([])
  }
}))

describe('HealthCheckService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    process.env.QLOO_API_KEY = 'test-qloo-key'
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  describe('performHealthCheck', () => {
    it('should perform basic health check', async () => {
      const health = await HealthCheckService.performHealthCheck(false)

      expect(health).toMatchObject({
        overall: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        services: expect.arrayContaining([
          expect.objectContaining({
            service: 'database',
            healthy: expect.any(Boolean),
            responseTime: expect.any(Number),
            timestamp: expect.any(Date)
          }),
          expect.objectContaining({
            service: 'qloo',
            healthy: expect.any(Boolean),
            responseTime: expect.any(Number),
            timestamp: expect.any(Date)
          }),
          expect.objectContaining({
            service: 'gemini',
            healthy: expect.any(Boolean),
            responseTime: expect.any(Number),
            timestamp: expect.any(Date)
          }),
          expect.objectContaining({
            service: 'redis',
            healthy: expect.any(Boolean),
            responseTime: expect.any(Number),
            timestamp: expect.any(Date)
          })
        ]),
        timestamp: expect.any(Date),
        version: expect.any(String),
        environment: expect.any(String)
      })
    })

    it('should perform detailed health check', async () => {
      const health = await HealthCheckService.performHealthCheck(true)

      expect(health.services).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            service: 'database',
            details: expect.objectContaining({
              basicConnectivity: 'passed'
            })
          }),
          expect.objectContaining({
            service: 'qloo',
            details: expect.objectContaining({
              cacheStats: expect.any(Object)
            })
          }),
          expect.objectContaining({
            service: 'gemini',
            details: expect.objectContaining({
              model: expect.any(String),
              config: expect.any(Object)
            })
          })
        ])
      )
    })

    it('should handle service failures gracefully', async () => {
      // Mock a service failure
      const { createCachedQlooService } = await import('../cached-qloo.service')
      const mockQlooService = createCachedQlooService as Mock
      mockQlooService.mockReturnValue({
        getCacheStats: vi.fn().mockRejectedValue(new Error('Qloo service unavailable'))
      })

      const health = await HealthCheckService.performHealthCheck(false)

      const qlooService = health.services.find(s => s.service === 'qloo')
      expect(qlooService).toMatchObject({
        service: 'qloo',
        healthy: false,
        error: expect.stringContaining('Qloo service unavailable')
      })
    })

    it('should determine overall health status correctly', async () => {
      const health = await HealthCheckService.performHealthCheck(false)

      const criticalServices = health.services.filter(s => 
        ['database', 'qloo', 'gemini'].includes(s.service)
      )
      const healthyCount = criticalServices.filter(s => s.healthy).length
      const totalCritical = criticalServices.length

      if (healthyCount === totalCritical) {
        expect(health.overall).toBe('healthy')
      } else if (healthyCount > 0) {
        expect(health.overall).toBe('degraded')
      } else {
        expect(health.overall).toBe('unhealthy')
      }
    })
  })

  describe('service-specific health checks', () => {
    it('should handle missing API keys', async () => {
      delete process.env.QLOO_API_KEY
      delete process.env.GEMINI_API_KEY

      const health = await HealthCheckService.performHealthCheck(false)

      const qlooService = health.services.find(s => s.service === 'qloo')
      const geminiService = health.services.find(s => s.service === 'gemini')

      expect(qlooService).toMatchObject({
        healthy: false,
        error: 'QLOO_API_KEY not configured'
      })

      expect(geminiService).toMatchObject({
        healthy: false,
        error: 'GEMINI_API_KEY not configured'
      })
    })

    it('should handle database connection issues', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase')
      const mockFrom = supabaseAdmin.from as Mock
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ 
              error: { message: 'Connection failed' } 
            })
          }))
        }))
      })

      const health = await HealthCheckService.performHealthCheck(false)

      const dbService = health.services.find(s => s.service === 'database')
      expect(dbService).toMatchObject({
        healthy: false,
        error: expect.stringContaining('Connection failed')
      })
    })
  })

  describe('getHealthHistory', () => {
    it('should handle errors gracefully', async () => {
      const { LoggingService } = await import('../logging.service')
      const mockGetMetrics = LoggingService.getMetrics as Mock
      
      mockGetMetrics.mockRejectedValue(new Error('Database error'))

      const history = await HealthCheckService.getHealthHistory(24, 'database')

      expect(history).toEqual([])
    })
  })
})