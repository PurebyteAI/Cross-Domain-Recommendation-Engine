import { vi } from 'vitest'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// Setup environment variables for tests
process.env.QLOO_API_KEY = 'test-api-key'
process.env.QLOO_API_URL = 'https://test-api.qloo.com'
process.env.GEMINI_API_KEY = 'test-gemini-key'
process.env.GEMINI_MODEL = 'gemini-test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock Redis
vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      disconnect: vi.fn(),
      on: vi.fn(),
    }))
  }
})