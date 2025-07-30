import { createClient, RedisClientType } from 'redis';
import { createHash } from 'crypto';

// Cache configuration
export const CACHE_CONFIG = {
  L1: {
    maxSize: 1000, // Maximum number of items in L1 cache
    ttl: 5 * 60 * 1000, // 5 minutes in milliseconds
  },
  L2: {
    ttl: 24 * 60 * 60, // 24 hours in seconds (Redis TTL)
  },
  L3: {
    ttl: 7 * 24 * 60 * 60, // 7 days in seconds (Database TTL)
  },
} as const;

// Cache key namespaces
export const CACHE_NAMESPACES = {
  QLOO_INSIGHTS: 'qloo:insights',
  QLOO_RECOMMENDATIONS: 'qloo:recommendations',
  QLOO_ENTITY_SEARCH: 'qloo:entity_search',
  GEMINI_EXPLANATIONS: 'gemini:explanation',
  USER_PREFERENCES: 'user:preferences',
  SYSTEM_METRICS: 'system:metrics',
} as const;

// L1 Cache (In-Memory) interface
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// L1 Cache (In-Memory) implementation
class L1Cache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize: number;

  constructor(maxSize: number = CACHE_CONFIG.L1.maxSize) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set<T>(key: string, data: T, ttl: number = CACHE_CONFIG.L1.ttl): void {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Redis client singleton
class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            // Exponential backoff with max delay of 10 seconds
            return Math.min(retries * 100, 10000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.client = null;
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// Multi-level cache service
class CacheService {
  private l1Cache: L1Cache;
  private redisClient: RedisClient;

  constructor() {
    this.l1Cache = new L1Cache();
    this.redisClient = RedisClient.getInstance();
    
    // Initialize Redis connection
    this.redisClient.connect().catch(err => {
      console.warn('Redis connection failed, using L1 cache only:', err);
    });

    // Cleanup expired L1 cache items every 5 minutes
    setInterval(() => {
      this.l1Cache.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get value from cache (tries L1 first, then L2/Redis)
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = `${namespace}:${key}`;

    // Try L1 cache first
    const l1Result = this.l1Cache.get<T>(fullKey);
    if (l1Result !== null) {
      return l1Result;
    }

    // Try L2 cache (Redis)
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          const redisResult = await client.get(fullKey);
          if (redisResult) {
            const parsed = JSON.parse(redisResult) as T;
            // Store in L1 cache for faster access
            this.l1Cache.set(fullKey, parsed);
            return parsed;
          }
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    return null;
  }

  /**
   * Set value in cache (stores in both L1 and L2)
   */
  async set<T>(namespace: string, key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = `${namespace}:${key}`;
    const ttl = ttlSeconds || CACHE_CONFIG.L2.ttl;

    // Store in L1 cache
    this.l1Cache.set(fullKey, value, ttl * 1000); // Convert to milliseconds

    // Store in L2 cache (Redis)
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          await client.setEx(fullKey, ttl, JSON.stringify(value));
        }
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
  }

  /**
   * Delete value from cache
   */
  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = `${namespace}:${key}`;

    // Delete from L1 cache
    this.l1Cache.delete(fullKey);

    // Delete from L2 cache (Redis)
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          await client.del(fullKey);
        }
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
  }

  /**
   * Clear all cache entries for a namespace
   */
  async clearNamespace(namespace: string): Promise<void> {
    // Clear L1 cache entries for namespace
    this.l1Cache.clear(); // Simple approach - clear all L1

    // Clear L2 cache entries for namespace
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          const keys = await client.keys(`${namespace}:*`);
          if (keys.length > 0) {
            await client.del(keys);
          }
        }
      } catch (error) {
        console.error('Redis clearNamespace error:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    l1Size: number;
    l2Connected: boolean;
    l2Size?: number;
  }> {
    const stats = {
      l1Size: this.l1Cache.size(),
      l2Connected: this.redisClient.isClientConnected(),
    };

    // Try to get Redis info
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          const info = await client.info('keyspace');
          // Parse keyspace info to get approximate key count
          const match = info.match(/keys=(\d+)/);
          if (match) {
            (stats as any).l2Size = parseInt(match[1]);
          }
        }
      } catch (error) {
        console.error('Redis stats error:', error);
      }
    }

    return stats;
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ healthy: boolean; l1: boolean; l2: boolean }> {
    const l1Healthy = true; // L1 cache is always available
    let l2Healthy = false;

    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          await client.ping();
          l2Healthy = true;
        }
      } catch (error) {
        console.error('Redis health check failed:', error);
      }
    }

    return {
      healthy: l1Healthy, // Service is healthy if L1 is working
      l1: l1Healthy,
      l2: l2Healthy,
    };
  }
}

// Cache key utilities
export class CacheUtils {
  /**
   * Generate a consistent cache key for entity search
   */
  static generateEntitySearchKey(name: string, type: string): string {
    const normalized = `${name.toLowerCase().trim()}:${type.toLowerCase()}`;
    return createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Generate a consistent cache key for entity insights
   */
  static generateInsightsKey(entityId: string): string {
    return entityId;
  }

  /**
   * Generate a consistent cache key for recommendations
   */
  static generateRecommendationsKey(
    tags: Array<{ tag_id: string; affinity: number }>,
    targetDomains: string[]
  ): string {
    const sortedTags = tags
      .sort((a, b) => b.affinity - a.affinity)
      .map(t => `${t.tag_id}:${t.affinity.toFixed(2)}`)
      .join(',');
    
    const sortedDomains = targetDomains.sort().join(',');
    const combined = `${sortedTags}|${sortedDomains}`;
    
    return createHash('md5').update(combined).digest('hex');
  }

  /**
   * Generate a consistent cache key for explanations
   */
  static generateExplanationKey(
    inputEntity: string,
    recommendedEntity: string
  ): string {
    const combined = `${inputEntity}:${recommendedEntity}`;
    return createHash('md5').update(combined).digest('hex');
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export types and utilities
export type { CacheItem };
export { L1Cache, RedisClient, CacheService };