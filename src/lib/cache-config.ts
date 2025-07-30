// Cache configuration and initialization utilities

import { cacheService } from './cache';

// Environment-specific cache configuration
export const getCacheConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    // Redis connection settings
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      enabled: !isTest && process.env.REDIS_URL !== undefined,
      maxRetries: isProduction ? 5 : 3,
      retryDelayMs: isProduction ? 1000 : 500,
    },
    
    // L1 Cache settings
    l1: {
      maxSize: parseInt(process.env.CACHE_L1_MAX_SIZE || '1000'),
      ttlMs: parseInt(process.env.CACHE_L1_TTL_MS || '300000'), // 5 minutes
    },
    
    // L2 Cache settings (Redis)
    l2: {
      ttlSeconds: parseInt(process.env.CACHE_L2_TTL_SECONDS || '86400'), // 24 hours
    },
    
    // L3 Cache settings (Database)
    l3: {
      ttlSeconds: parseInt(process.env.CACHE_L3_TTL_SECONDS || '604800'), // 7 days
    },
    
    // Feature flags
    features: {
      enableL1Cache: process.env.CACHE_L1_ENABLED !== 'false',
      enableL2Cache: process.env.CACHE_L2_ENABLED !== 'false' && !isTest,
      enableMetrics: process.env.CACHE_METRICS_ENABLED === 'true',
      enableDebugLogs: process.env.CACHE_DEBUG_LOGS === 'true' || !isProduction,
    },
  };
};

// Initialize cache service with proper error handling
export const initializeCache = async (): Promise<boolean> => {
  const config = getCacheConfig();
  
  try {
    if (config.features.enableDebugLogs) {
      console.log('Initializing cache service with config:', {
        redis: { enabled: config.redis.enabled, url: config.redis.url ? '[CONFIGURED]' : '[NOT SET]' },
        l1: config.l1,
        features: config.features,
      });
    }
    
    await cacheService.initialize();
    
    // Verify cache health
    const health = await cacheService.healthCheck();
    
    if (config.features.enableDebugLogs) {
      console.log('Cache health check:', health);
    }
    
    // Log warnings for degraded functionality
    if (config.redis.enabled && !health.l2) {
      console.warn('Redis cache unavailable - falling back to L1 cache only');
    }
    
    return health.l1; // At minimum, L1 cache should be available
    
  } catch (error) {
    console.error('Failed to initialize cache service:', error);
    
    // In production, we might want to fail fast
    if (process.env.NODE_ENV === 'production' && config.redis.enabled) {
      throw new Error('Cache initialization failed in production environment');
    }
    
    return false;
  }
};

// Graceful shutdown
export const shutdownCache = async (): Promise<void> => {
  const config = getCacheConfig();
  
  try {
    if (config.features.enableDebugLogs) {
      console.log('Shutting down cache service...');
    }
    
    await cacheService.shutdown();
    
    if (config.features.enableDebugLogs) {
      console.log('Cache service shutdown complete');
    }
  } catch (error) {
    console.error('Error during cache shutdown:', error);
  }
};

// Cache health monitoring utility
export const getCacheHealth = async () => {
  try {
    const [health, stats] = await Promise.all([
      cacheService.healthCheck(),
      cacheService.getStats(),
    ]);
    
    return {
      healthy: health.l1 && (getCacheConfig().redis.enabled ? health.l2 : true),
      details: {
        l1: {
          healthy: health.l1,
          stats: stats.l1,
        },
        l2: {
          healthy: health.l2,
          enabled: getCacheConfig().redis.enabled,
          stats: stats.l2,
        },
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Utility for cache warming (pre-loading common data)
export const warmCache = async (warmupData?: Array<{ namespace: string; key: string; data: any }>) => {
  const config = getCacheConfig();
  
  if (!config.features.enableL1Cache && !config.features.enableL2Cache) {
    console.log('Cache warming skipped - caching disabled');
    return;
  }
  
  if (!warmupData || warmupData.length === 0) {
    console.log('No warmup data provided');
    return;
  }
  
  try {
    if (config.features.enableDebugLogs) {
      console.log(`Warming cache with ${warmupData.length} items...`);
    }
    
    const promises = warmupData.map(({ namespace, key, data }) =>
      cacheService.set(namespace, key, data)
    );
    
    await Promise.all(promises);
    
    if (config.features.enableDebugLogs) {
      console.log('Cache warming completed successfully');
    }
  } catch (error) {
    console.error('Cache warming failed:', error);
  }
};

// Export the configured cache service
export { cacheService };
export * from './cache';