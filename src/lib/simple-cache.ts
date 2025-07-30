// Web API compatible hash function for Edge Runtime
async function createMD5Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Simple in-memory cache for development/testing
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize: number = 1000;

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

  set<T>(key: string, data: T, ttlSeconds: number = 3600): void {
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
      ttl: ttlSeconds * 1000, // Convert to milliseconds
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

// Cache service with namespaces
class SimpleCacheService {
  private cache: SimpleCache;

  constructor() {
    this.cache = new SimpleCache();
    
    // Cleanup expired items every 5 minutes
    setInterval(() => {
      this.cache.cleanup();
    }, 5 * 60 * 1000);
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = `${namespace}:${key}`;
    return this.cache.get<T>(fullKey);
  }

  async set<T>(namespace: string, key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    const fullKey = `${namespace}:${key}`;
    this.cache.set(fullKey, value, ttlSeconds);
  }

  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = `${namespace}:${key}`;
    this.cache.delete(fullKey);
  }

  async clearNamespace(namespace: string): Promise<void> {
    // Simple approach - clear all cache
    this.cache.clear();
  }

  async getStats(): Promise<{
    l1Size: number;
    l2Connected: boolean;
  }> {
    return {
      l1Size: this.cache.size(),
      l2Connected: false,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; l1: boolean; l2: boolean }> {
    return {
      healthy: true,
      l1: true,
      l2: false,
    };
  }
}

// Cache key namespaces
export const CACHE_NAMESPACES = {
  QLOO_INSIGHTS: 'qloo:insights',
  QLOO_RECOMMENDATIONS: 'qloo:recommendations',
  QLOO_ENTITY_SEARCH: 'qloo:entity_search',
  GEMINI_EXPLANATIONS: 'gemini:explanation',
  USER_PREFERENCES: 'user:preferences',
  SYSTEM_METRICS: 'system:metrics',
} as const;

// Cache key utilities
export class CacheUtils {
  static async generateEntitySearchKey(name: string, type: string): Promise<string> {
    const normalized = `${name.toLowerCase().trim()}:${type.toLowerCase()}`;
    return await createMD5Hash(normalized);
  }

  static generateInsightsKey(entityId: string): string {
    return entityId;
  }

  static async generateRecommendationKey(
    tags: Array<{ tag_id: string; affinity: number }>,
    targetDomains: string[]
  ): Promise<string> {
    const sortedTags = tags
      .sort((a, b) => b.affinity - a.affinity)
      .map(t => `${t.tag_id}:${t.affinity.toFixed(2)}`)
      .join(',');
    
    const sortedDomains = targetDomains.sort().join(',');
    const combined = `${sortedTags}|${sortedDomains}`;
    
    return await createMD5Hash(combined);
  }

  static async generateExplanationKey(
    inputEntity: string,
    recommendedEntity: string
  ): Promise<string> {
    const combined = `${inputEntity}:${recommendedEntity}`;
    return await createMD5Hash(combined);
  }
}

// Export singleton instance
export const cacheService = new SimpleCacheService();