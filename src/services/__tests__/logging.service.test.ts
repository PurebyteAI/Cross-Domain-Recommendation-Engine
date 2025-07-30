import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null })
    }))
  }
}))

// Import after mocking
import { LoggingService } from '../logging.service'

describe('LoggingService', () => {
  let mockInsert: Mock
  let mockFrom: Mock

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Get fresh mock references
    const { supabaseAdmin } = await import('@/lib/supabase')
    mockFrom = supabaseAdmin.from as Mock
    mockInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      insert: mockInsert
    })
  })

  afterEach(async () => {
    // Clean up any pending flushes
    await LoggingService.flush()
  })

  describe('info logging', () => {
    it('should log info messages', async () => {
      LoggingService.info('Test info message', {
        service: 'test-service',
        operation: 'test-operation',
        userId: 'user123'
      })

      // Force flush to trigger database write
      await LoggingService.flush()

      expect(mockFrom).toHaveBeenCalledWith('error_logs')
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          level: 'info',
          error_code: 'LOG_ENTRY',
          error_message: 'Test info message',
          status_code: 200,
          is_operational: true,
          is_retryable: false,
          user_id: 'user123',
          context_metadata: expect.objectContaining({
            service: 'test-service',
            operation: 'test-operation'
          })
        })
      ])
    })
  })

  describe('error logging', () => {
    it('should log error messages with error details', async () => {
      const testError = new Error('Test error')
      testError.stack = 'Error stack trace'

      LoggingService.error('Test error message', testError, {
        service: 'test-service',
        operation: 'test-operation',
        statusCode: 500
      })

      // Force flush to trigger database write
      await LoggingService.flush()

      expect(mockFrom).toHaveBeenCalledWith('error_logs')
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          level: 'error',
          error_code: 'LOG_ENTRY',
          error_message: 'Test error message',
          status_code: 500,
          is_operational: false,
          is_retryable: false,
          error_details: {
            code: undefined,
            message: 'Test error'
          },
          stack_trace: 'Error stack trace',
          context_metadata: expect.objectContaining({
            service: 'test-service',
            operation: 'test-operation'
          })
        })
      ])
    })

    it('should auto-flush on error messages', async () => {
      LoggingService.error('Critical error', new Error('Test'), {
        service: 'test-service'
      })

      // Should auto-flush without manual flush call
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('metrics recording', () => {
    it('should record single metrics', async () => {
      LoggingService.metric('test_metric', 42, {
        unit: 'ms',
        tags: { endpoint: '/test' }
      })

      await LoggingService.flush()

      expect(mockFrom).toHaveBeenCalledWith('system_metrics')
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metric_name: 'test_metric',
          metric_value: 42,
          tags: expect.objectContaining({
            unit: 'ms',
            endpoint: '/test'
          })
        })
      ])
    })

    it('should record multiple metrics', async () => {
      const metrics = [
        { name: 'metric1', value: 10, unit: 'count' },
        { name: 'metric2', value: 20, unit: 'ms' }
      ]

      LoggingService.metrics(metrics)
      await LoggingService.flush()

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metric_name: 'metric1',
          metric_value: 10,
          tags: expect.objectContaining({ unit: 'count' })
        }),
        expect.objectContaining({
          metric_name: 'metric2',
          metric_value: 20,
          tags: expect.objectContaining({ unit: 'ms' })
        })
      ])
    })
  })

  describe('buffering and flushing', () => {
    it('should buffer logs and flush periodically', async () => {
      // Add multiple log entries
      for (let i = 0; i < 5; i++) {
        LoggingService.info(`Message ${i}`, { service: 'test' })
      }

      // Should not have flushed yet (buffer not full)
      expect(mockInsert).not.toHaveBeenCalled()

      // Manual flush
      await LoggingService.flush()

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ error_message: 'Message 0' }),
          expect.objectContaining({ error_message: 'Message 1' }),
          expect.objectContaining({ error_message: 'Message 2' }),
          expect.objectContaining({ error_message: 'Message 3' }),
          expect.objectContaining({ error_message: 'Message 4' })
        ])
      )
    })

    it('should handle flush errors gracefully', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database error'))

      LoggingService.info('Test message', { service: 'test' })
      
      // Should not throw
      await expect(LoggingService.flush()).resolves.not.toThrow()
    })
  })

  describe('querying logs', () => {
    it('should handle query errors gracefully', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Query failed') })
            }))
          }))
        }))
      })

      const logs = await LoggingService.getRecentLogs(10, 'info', 'test-service')

      expect(logs).toEqual([])
    })
  })

  describe('cleanup', () => {
    it('should cleanup old logs and metrics', async () => {
      const mockDelete = vi.fn()
      const mockLt = vi.fn()
      const mockSelect = vi.fn()

      mockSelect.mockReturnValue({ data: [{ id: '1' }, { id: '2' }], error: null })
      mockLt.mockReturnValue({ select: mockSelect })
      mockDelete.mockReturnValue({ lt: mockLt })
      mockFrom.mockReturnValue({ delete: mockDelete })

      const result = await LoggingService.cleanup(30)

      expect(mockDelete).toHaveBeenCalled()
      expect(result.logsDeleted).toBe(2)
      expect(result.metricsDeleted).toBe(2)
    })
  })
})