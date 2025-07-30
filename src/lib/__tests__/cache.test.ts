import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, CACHE_NAMESPACES, CacheUtils } from '../cache';

// Mock Redis client
const mockRedisClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  get: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  ping: vi.fn(),
  info: vi.fn(),
  on: vi.fn(),
};

// Mock the redis module
vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create fresh cache instance
    cache = new CacheService();
    
    // Mock successful Redis connection
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue('PONG');
    
    // Initialize cache and manually set connection state for testing
    await cache.initialize();
    
    // Force the Redis client to be connected for testing
    (cache as any).redisClient.setConnectionState(true);
  });

  afterEach(async () => {
    await cache.shutdown();
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for string identifiers', () => {
      const key1 = cache.generateKey(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-entity');
      const key2 = cache.generateKey(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-entity');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('qloo:insights:test-entity');
    });

    it('should generate consistent keys for object identifiers', () => {
      const obj = { name: 'test', type: 'movie' };
      const key1 = cache.generateKey(CACHE_NAMESPACES.QLOO_ENTITY_SEARCH, obj);
      const key2 = cache.generateKey(CACHE_NAMESPACES.QLOO_ENTITY_SEARCH, obj);
      
      expect(key1).toBe(key2);
      expect(key1).toContain('qloo:entity_search:');
    });

    it('should hash long keys to prevent Redis key length issues', () => {
      const longString = 'a'.repeat(300);
      const key = cache.generateKey(CACHE_NAMESPACES.QLOO_INSIGHTS, longString);
      
      expect(key.length).toBeLessThan(100);
      expect(key).toMatch(/^qloo:insights:[a-f0-9]{64}$/);
    });
  });

  describe('L1 Cache (In-Memory)', () => {
    it('should store and retrieve data from L1 cache', async () => {
      const testData = { id: '1', name: 'test' };
      
      await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key', testData);
      const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
      
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'non-existent');
      expect(result).toBeNull();
    });

    it('should handle TTL expiration in L1 cache', async () => {
      const testData = { id: '1', name: 'test' };
      
      // Set with very short TTL (1ms)
      await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key', testData, 0.001);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
      expect(result).toBeNull();
    });
  });

  describe('L2 Cache (Redis)', () => {
    it('should store data in Redis when available', async () => {
      const testData = { id: '1', name: 'test' };
      
      await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key', testData);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'qloo:insights:test-key',
        86400, // 24 hours default TTL
        JSON.stringify(testData)
      );
    });

    it('should retrieve data from Redis when not in L1 cache', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));
      
      const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('qloo:insights:test-key');
      expect(result).toEqual(testData);
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
      expect(result).toBeNull();
    });

    it('should delete from both L1 and Redis', async () => {
      await cache.delete(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('qloo:insights:test-key');
    });
  });

  describe('Cache Invalidation', () => {
    it('should clear namespace in Redis', async () => {
      mockRedisClient.keys.mockResolvedValue(['qloo:insights:key1', 'qloo:insights:key2']);
      mockRedisClient.del.mockResolvedValue(2);
      
      await cache.clearNamespace(CACHE_NAMESPACES.QLOO_INSIGHTS);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('qloo:insights:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(['qloo:insights:key1', 'qloo:insights:key2']);
    });

    it('should handle empty namespace clearing', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      
      await cache.clearNamespace(CACHE_NAMESPACES.QLOO_INSIGHTS);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('qloo:insights:*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when Redis is connected', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      
      const health = await cache.healthCheck();
      
      expect(health.l1).toBe(true);
      expect(health.l2).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return unhealthy L2 status when Redis fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis down'));
      
      const health = await cache.healthCheck();
      
      expect(health.l1).toBe(true);
      expect(health.l2).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    it('should return L1 cache statistics', async () => {
      // Add some data to L1 cache
      await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'key1', { data: 'test1' });
      await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'key2', { data: 'test2' });
      
      const stats = await cache.getStats();
      
      expect(stats.l1).toHaveProperty('size');
      expect(stats.l1).toHaveProperty('maxSize');
      expect(stats.l1).toHaveProperty('utilization');
      expect(stats.l1.size).toBeGreaterThan(0);
    });

    it('should return Redis statistics when connected', async () => {
      mockRedisClient.info.mockResolvedValue('used_memory:1024\nused_memory_human:1K');
      
      const stats = await cache.getStats();
      
      expect(stats.l2).toHaveProperty('connected', true);
      expect(stats.l2).toHaveProperty('memory');
    });
  });
});

describe('CacheUtils', () => {
  describe('hashTags', () => {
    it('should generate consistent hashes for same tags', () => {
      const tags = [
        { tag_id: 'melancholy', affinity: 0.95 },
        { tag_id: 'experimental', affinity: 0.88 },
      ];
      
      const hash1 = CacheUtils.hashTags(tags);
      const hash2 = CacheUtils.hashTags(tags);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate same hash regardless of tag order', () => {
      const tags1 = [
        { tag_id: 'melancholy', affinity: 0.95 },
        { tag_id: 'experimental', affinity: 0.88 },
      ];
      
      const tags2 = [
        { tag_id: 'experimental', affinity: 0.88 },
        { tag_id: 'melancholy', affinity: 0.95 },
      ];
      
      const hash1 = CacheUtils.hashTags(tags1);
      const hash2 = CacheUtils.hashTags(tags2);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different tags', () => {
      const tags1 = [{ tag_id: 'melancholy', affinity: 0.95 }];
      const tags2 = [{ tag_id: 'experimental', affinity: 0.88 }];
      
      const hash1 = CacheUtils.hashTags(tags1);
      const hash2 = CacheUtils.hashTags(tags2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRecommendationKey', () => {
    it('should generate consistent keys for same inputs', async () => {
      const tags = [{ tag_id: 'melancholy', affinity: 0.95 }];
      const domains = ['books', 'movies'];
      
      const key1 = await CacheUtils.generateRecommendationKey(tags, domains);
      const key2 = await CacheUtils.generateRecommendationKey(tags, domains);
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(32); // MD5 hash length
    });

    it('should generate same key regardless of domain order', async () => {
      const tags = [{ tag_id: 'melancholy', affinity: 0.95 }];
      const domains1 = ['books', 'movies'];
      const domains2 = ['movies', 'books'];
      
      const key1 = await CacheUtils.generateRecommendationKey(tags, domains1);
      const key2 = await CacheUtils.generateRecommendationKey(tags, domains2);
      
      expect(key1).toBe(key2);
    });
  });

  describe('generateEntitySearchKey', () => {
    it('should generate consistent keys for entity search', async () => {
      const key1 = await CacheUtils.generateEntitySearchKey('Radiohead', 'artist');
      const key2 = await CacheUtils.generateEntitySearchKey('Radiohead', 'artist');
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(32); // MD5 hash length
    });

    it('should normalize case for consistency', async () => {
      const key1 = await CacheUtils.generateEntitySearchKey('RADIOHEAD', 'artist');
      const key2 = await CacheUtils.generateEntitySearchKey('radiohead', 'artist');
      
      expect(key1).toBe(key2);
    });
  });

  describe('generateExplanationKey', () => {
    it('should generate consistent keys for explanations', async () => {
      const key1 = await CacheUtils.generateExplanationKey('radiohead', 'kafka-on-shore');
      const key2 = await CacheUtils.generateExplanationKey('radiohead', 'kafka-on-shore');
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(32); // MD5 hash length
    });
  });
});

describe('Cache Integration Scenarios', () => {
  let cache: CacheService;

  beforeEach(async () => {
    vi.clearAllMocks();
    cache = new CacheService();
    mockRedisClient.connect.mockResolvedValue(undefined);
    await cache.initialize();
    
    // Force the Redis client to be connected for testing
    (cache as any).redisClient.setConnectionState(true);
  });

  afterEach(async () => {
    await cache.shutdown();
  });

  it('should handle cache miss scenario', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    
    const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'missing-key');
    
    expect(result).toBeNull();
    expect(mockRedisClient.get).toHaveBeenCalledWith('qloo:insights:missing-key');
  });

  it('should handle cache hit scenario with L1 cache', async () => {
    const testData = { id: '1', name: 'test' };
    
    // First set the data
    await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key', testData);
    
    // Clear Redis mock calls to verify L1 cache hit
    vi.clearAllMocks();
    
    // Get the data (should come from L1 cache)
    const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
    
    expect(result).toEqual(testData);
    expect(mockRedisClient.get).not.toHaveBeenCalled(); // Should not hit Redis
  });

  it('should handle cache hit scenario with L2 cache (Redis)', async () => {
    const testData = { id: '1', name: 'test' };
    mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));
    
    // Get data that's only in Redis (not in L1)
    const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'redis-only-key');
    
    expect(result).toEqual(testData);
    expect(mockRedisClient.get).toHaveBeenCalledWith('qloo:insights:redis-only-key');
  });

  it('should handle Redis failure gracefully and fall back to L1 only', async () => {
    const testData = { id: '1', name: 'test' };
    
    // Mock Redis failure
    mockRedisClient.setEx.mockRejectedValue(new Error('Redis connection failed'));
    mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
    
    // Should still work with L1 cache only
    await cache.set(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key', testData);
    const result = await cache.get(CACHE_NAMESPACES.QLOO_INSIGHTS, 'test-key');
    
    expect(result).toEqual(testData);
  });
});