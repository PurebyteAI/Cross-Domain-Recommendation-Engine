import { createHash } from 'crypto';

// Conditional Redis import for server-side only
let RedisClientType: any = null;
let createClient: any = null;

if (typeof window === 'undefined') {
  try {
    const redis = require('redis');
    createClient = redis.createClient;
    RedisClientType = redis.RedisClientType;
  } catch (error) {
    console.warn('Redis not available:', error);
  }
}

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

// L1 Cache implementation using Map
class L1Cache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(maxSize: number = CACHE_CONFIG.L1.maxSize, defaultTtl: number = CACHE_CONFIG.L1.ttl) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Remove expired items and enforce size limit
    this.cleanup();
    
    if (this.cache.size >= this.maxSize) {
      // Remove oldest item (LRU-like behavior)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100,
    };
  }
}

// Redis client singleton
class RedisClient {
  private static instance: RedisClient;
  private client: any = null;
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

    if (!createClient) {
      console.warn('Redis not available, skipping connection');
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            // Exponential backoff with max delay of 10 seconds
            return Math.min(retries * 100, 10000);
          },
        },
      });

      this.client.on('error', (err: Error) => {
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
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  getClient(): any {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  // For testing purposes
  setConnectionState(connected: boolean): void {
    this.isConnected = connected;
  }

  // Reset singleton for testing
  static resetInstance(): void {
    RedisClient.instance = null as any;
  }
}

// Multi-level cache service
export class CacheService {
  private l1Cache: L1Cache;
  private redisClient: RedisClient;

  constructor() {
    this.l1Cache = new L1Cache();
    this.redisClient = RedisClient.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
    } catch (error) {
      console.warn('Redis connection failed, falling back to L1 cache only:', error);
    }
  }

  // Generate cache key with namespace and hashing for long keys
  generateKey(namespace: string, identifier: string | object): string {
    const keyString = typeof identifier === 'string' ? identifier : JSON.stringify(identifier);
    
    // Hash long keys to prevent Redis key length issues
    if (keyString.length > 200) {
      const hash = createHash('sha256').update(keyString).digest('hex');
      return `${namespace}:${hash}`;
    }
    
    return `${namespace}:${keyString}`;
  }

  // Get from cache (tries L1 first, then L2/Redis)
  async get<T>(namespace: string, identifier: string | object): Promise<T | null> {
    const key = this.generateKey(namespace, identifier);

    // Try L1 cache first
    const l1Result = this.l1Cache.get<T>(key);
    if (l1Result !== null) {
      return l1Result;
    }

    // Try L2 cache (Redis) if available
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          const redisResult = await client.get(key);
          if (redisResult) {
            const data = JSON.parse(redisResult) as T;
            // Store in L1 cache for faster future access
            this.l1Cache.set(key, data);
            return data;
          }
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    return null;
  }

  // Set in cache (stores in both L1 and L2)
  async set<T>(
    namespace: string,
    identifier: string | object,
    data: T,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey(namespace, identifier);
    const l2Ttl = ttl || CACHE_CONFIG.L2.ttl;

    // Store in L1 cache
    this.l1Cache.set(key, data, (ttl || CACHE_CONFIG.L1.ttl) * 1000); // Convert to milliseconds

    // Store in L2 cache (Redis) if available
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          await client.setEx(key, l2Ttl, JSON.stringify(data));
        }
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
  }

  // Delete from cache
  async delete(namespace: string, identifier: string | object): Promise<void> {
    const key = this.generateKey(namespace, identifier);

    // Delete from L1 cache
    this.l1Cache.delete(key);

    // Delete from L2 cache (Redis) if available
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          await client.del(key);
        }
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
  }

  // Clear cache by namespace pattern
  async clearNamespace(namespace: string): Promise<void> {
    // Clear L1 cache (we need to iterate through all keys)
    // Note: This is not efficient for L1, but necessary for namespace clearing
    // In production, consider implementing a more efficient namespace tracking

    // Clear L2 cache (Redis) by pattern if available
    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          const pattern = `${namespace}:*`;
          const keys = await client.keys(pattern);
          if (keys.length > 0) {
            await client.del(keys);
          }
        }
      } catch (error) {
        console.error('Redis clear namespace error:', error);
      }
    }
  }

  // Get cache statistics
  async getStats() {
    const l1Stats = this.l1Cache.getStats();
    let redisStats = null;

    if (this.redisClient.isClientConnected()) {
      try {
        const client = this.redisClient.getClient();
        if (client) {
          const info = await client.info('memory');
          redisStats = {
            connected: true,
            memory: info,
          };
        }
      } catch (error) {
        console.error('Redis stats error:', error);
        redisStats = { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    } else {
      redisStats = { connected: false };
    }

    return {
      l1: l1Stats,
      l2: redisStats,
    };
  }

  // Health check
  async healthCheck(): Promise<{ l1: boolean; l2: boolean }> {
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

    return { l1: l1Healthy, l2: l2Healthy };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.l1Cache.clear();
    await this.redisClient.disconnect();
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Utility functions for common cache operations
export const CacheUtils = {
  // Hash tags for consistent cache keys
  hashTags: (tags: Array<{ tag_id: string; affinity: number }>): string => {
    const sortedTags = tags
      .sort((a, b) => a.tag_id.localeCompare(b.tag_id))
      .map(tag => `${tag.tag_id}:${tag.affinity}`)
      .join(',');
    return createHash('md5').update(sortedTags).digest('hex');
  },

  // Generate cache key for cross-domain recommendations
  generateRecommendationKey: (
    tags: Array<{ tag_id: string; affinity: number }>,
    targetDomains: string[]
  ): string => {
    const tagHash = CacheUtils.hashTags(tags);
    const domainString = targetDomains.sort().join(',');
    return `${tagHash}:${domainString}`;
  },

  // Generate cache key for entity search
  generateEntitySearchKey: (name: string, type: string): string => {
    return `${name.toLowerCase()}:${type}`;
  },

  // Generate cache key for explanations
  generateExplanationKey: (inputEntity: string, recommendedEntity: string): string => {
    return `${inputEntity}:${recommendedEntity}`;
  },
};