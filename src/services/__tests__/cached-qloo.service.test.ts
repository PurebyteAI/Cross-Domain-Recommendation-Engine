import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CachedQlooService Integration', () => {
  it('should be able to import and create the service', async () => {
    // Set up environment
    process.env.QLOO_API_KEY = 'test-key';
    process.env.QLOO_API_URL = 'https://test.api.qloo.com';

    const { CachedQlooService, createCachedQlooService } = await import('../cached-qloo.service');
    
    // Test factory function
    const service = createCachedQlooService();
    expect(service).toBeInstanceOf(CachedQlooService);
    
    // Test that service has expected methods
    expect(typeof service.searchEntity).toBe('function');
    expect(typeof service.getEntityInsights).toBe('function');
    expect(typeof service.getCrossDomainRecommendations).toBe('function');
    expect(typeof service.getEntityDetails).toBe('function');
    expect(typeof service.invalidateEntityCache).toBe('function');
    expect(typeof service.invalidateRecommendationCache).toBe('function');
    expect(typeof service.invalidateSearchCache).toBe('function');
    expect(typeof service.getCacheStats).toBe('function');
    expect(typeof service.warmupCache).toBe('function');
  });

  it('should throw error when API key is missing', async () => {
    delete process.env.QLOO_API_KEY;

    const { createCachedQlooService } = await import('../cached-qloo.service');
    
    expect(() => createCachedQlooService()).toThrow('QLOO_API_KEY environment variable is required');
  });

  it('should export cache management utilities', async () => {
    const { CacheManagement } = await import('../cached-qloo.service');
    
    expect(typeof CacheManagement.clearAllQlooCache).toBe('function');
    expect(typeof CacheManagement.getQlooCacheHealth).toBe('function');
  });
});

describe('Cache Configuration', () => {
  it('should export cache namespaces and utilities', async () => {
    const cacheModule = await import('@/lib/cache');
    
    expect(cacheModule.CACHE_NAMESPACES).toBeDefined();
    expect(cacheModule.CACHE_NAMESPACES.QLOO_INSIGHTS).toBe('qloo:insights');
    expect(cacheModule.CACHE_NAMESPACES.QLOO_RECOMMENDATIONS).toBe('qloo:recommendations');
    expect(cacheModule.CACHE_NAMESPACES.QLOO_ENTITY_SEARCH).toBe('qloo:entity_search');
    
    expect(cacheModule.CacheUtils).toBeDefined();
    expect(typeof cacheModule.CacheUtils.generateEntitySearchKey).toBe('function');
    expect(typeof cacheModule.CacheUtils.generateRecommendationKey).toBe('function');
    expect(typeof cacheModule.CacheUtils.generateExplanationKey).toBe('function');
    expect(typeof cacheModule.CacheUtils.hashTags).toBe('function');
  });

  it('should export cache configuration utilities', async () => {
    const configModule = await import('@/lib/cache-config');
    
    expect(typeof configModule.getCacheConfig).toBe('function');
    expect(typeof configModule.initializeCache).toBe('function');
    expect(typeof configModule.shutdownCache).toBe('function');
    expect(typeof configModule.getCacheHealth).toBe('function');
    expect(typeof configModule.warmCache).toBe('function');
  });
});

describe('Cache Utilities', () => {
  it('should generate consistent cache keys', async () => {
    const { CacheUtils } = await import('@/lib/simple-cache');
    
    // Test entity search key generation
    const searchKey1 = await CacheUtils.generateEntitySearchKey('Radiohead', 'artist');
    const searchKey2 = await CacheUtils.generateEntitySearchKey('RADIOHEAD', 'artist');
    expect(searchKey1).toBe(searchKey2); // Should normalize case
    expect(typeof searchKey1).toBe('string');
    expect(searchKey1.length).toBe(32); // MD5 hash length
    
    // Test explanation key generation
    const explanationKey = await CacheUtils.generateExplanationKey('radiohead', 'kafka-on-shore');
    expect(typeof explanationKey).toBe('string');
    expect(explanationKey.length).toBe(32); // MD5 hash length
    
    // Test recommendation key generation
    const tags = [
      { tag_id: 'melancholy', affinity: 0.95 },
      { tag_id: 'experimental', affinity: 0.88 },
    ];
    const recKey1 = await CacheUtils.generateRecommendationKey(tags, ['books', 'movies']);
    const recKey2 = await CacheUtils.generateRecommendationKey(tags, ['movies', 'books']); // Different order
    expect(recKey1).toBe(recKey2); // Should be order-independent
    expect(typeof recKey1).toBe('string');
    expect(recKey1.length).toBe(32); // MD5 hash length
  });
});