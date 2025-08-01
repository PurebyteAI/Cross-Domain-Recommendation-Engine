import { QlooService, QlooServiceConfig, QlooServiceError } from './qloo.service';
import { cacheService, CACHE_NAMESPACES, CacheUtils } from '@/lib/simple-cache';
import { QlooEntity, QlooInsights, QlooRecommendation, QlooTag } from '@/types';

/**
 * Cached wrapper for QlooService that implements multi-level caching
 * according to the requirements (4.1, 4.3)
 */
export class CachedQlooService extends QlooService {
  constructor(config: QlooServiceConfig) {
    super(config);
  }

  /**
   * Search for entities with caching
   * Cache key: entity_search:{name}:{type}
   * TTL: 24 hours for real entities, 5 minutes for fallback entities
   */
  async searchEntity(name: string, type: string): Promise<QlooEntity[]> {
    const cacheKey = await CacheUtils.generateEntitySearchKey(name, type);
    let cached: QlooEntity[] | null = null;
    
    // Try to get from cache first
    try {
      cached = await cacheService.get<QlooEntity[]>(
        CACHE_NAMESPACES.QLOO_ENTITY_SEARCH,
        cacheKey
      );
      
      if (cached) {
        // Check if cached data contains fallback entities
        const hasFallbackData = cached.some(entity => 
          entity.metadata?.fallback === true ||
          entity.id === '18B098FD-3D84-4609-BFF3-ADF9A0B00E40' // Known fallback ID
        );
        
        if (!hasFallbackData) {
          console.log(`[CachedQlooService] Cache hit for entity search: ${name} (${type})`);
          return cached;
        }
        
        console.log(`[CachedQlooService] Found cached fallback entity for ${name} (${type}), retrying API`);
      }
    } catch (error) {
      console.error(`[CachedQlooService] Error in searchEntity cache lookup:`, error);
      // Continue to API call despite cache errors
    }
    
    // Cache miss, fallback data, or cache error - fetch from API
    try {
      console.log(`[CachedQlooService] Cache miss or bypass for entity search: ${name} (${type})`);
      const results = await super.searchEntity(name, type);
      
      try {
        // Check if we got real data or fallback data
        const hasRealData = results.some(entity => 
          !entity.metadata?.fallback &&
          entity.id !== '18B098FD-3D84-4609-BFF3-ADF9A0B00E40'
        );
        
        if (hasRealData) {
          // Store real data in cache for 24 hours
          console.log(`[CachedQlooService] Caching real entity data for 24 hours`);
          await cacheService.set(
            CACHE_NAMESPACES.QLOO_ENTITY_SEARCH,
            cacheKey,
            results,
            24 * 60 * 60 // 24 hours
          );
        } else {
          // Store fallback data for only 5 minutes
          console.log(`[CachedQlooService] Caching fallback entity data for 5 minutes only`);
          await cacheService.set(
            CACHE_NAMESPACES.QLOO_ENTITY_SEARCH,
            cacheKey,
            results,
            5 * 60 // 5 minutes
          );
        }
      } catch (cacheError) {
        console.error(`[CachedQlooService] Error caching entity search results:`, cacheError);
        // Continue despite cache write errors, at least we have the results to return
      }
      
      return results;
    } catch (apiError) {
      console.error(`[CachedQlooService] API error in searchEntity:`, apiError);
      
      // If we have fallback cached data, return it even though we tried to avoid using it
      if (cached && cached.length > 0) {
        console.log(`[CachedQlooService] Falling back to cached data after API error`);
        return cached;
      }
      
      // Re-throw so upstream can handle
      throw apiError;
    }
  }

  /**
   * Get entity insights with caching
   * Cache key: insights:{entityId}:{entityType}
   * TTL: 24 hours (cultural tags are relatively stable)
   */
  async getEntityInsights(entityId: string, entityType: string): Promise<QlooInsights> {
    // Validate entity ID format before proceeding
    if (!entityId || entityId.startsWith('rec-') || entityId.startsWith('fallback-')) {
      console.log(`[CachedQlooService] Skipping insights for invalid entity ID: ${entityId}`)
      return { tags: [] }
    }

    const cacheKey = `${entityId}:${entityType}`
    
    // Try to get from cache first
    const cached = await cacheService.get<QlooInsights>(
      CACHE_NAMESPACES.QLOO_INSIGHTS,
      cacheKey
    );
    
    if (cached) {
      console.log(`[CachedQlooService] Cache hit for insights: ${entityId}`);
      return cached;
    }

    // Cache miss - fetch from API
    console.log(`[CachedQlooService] Cache miss for insights: ${entityId} (${entityType})`);
    const insights = await super.getEntityInsights(entityId, entityType);
    
    // Only cache if we got valid results
    if (insights.tags.length > 0) {
      await cacheService.set(
        CACHE_NAMESPACES.QLOO_INSIGHTS,
        cacheKey,
        insights,
        24 * 60 * 60 // 24 hours
      );
    }
    
    return insights;
  }

  /**
   * Get cross-domain recommendations with caching
   * Cache key: recommendations:{tagHash}:{sortedDomains}
   * TTL: 24 hours for real data, 5 minutes for fallback data
   */
  async getCrossDomainRecommendations(
    tags: QlooTag[], 
    targetDomains: string[], 
    limit: number = 5
  ): Promise<QlooRecommendation[]> {
    const cacheKey = await CacheUtils.generateRecommendationKey(tags, targetDomains);
    let cached: QlooRecommendation[] | null = null;
    
    // Try to get from cache first
    try {
      cached = await cacheService.get<QlooRecommendation[]>(
        CACHE_NAMESPACES.QLOO_RECOMMENDATIONS,
        cacheKey
      );
      
      if (cached) {
        // Check if cached data contains fallback entities
        const hasFallbackData = cached.some(rec => 
          rec.id.startsWith('fallback-') || 
          rec.metadata?.source === 'fallback'
        );
        
        if (!hasFallbackData) {
          console.log(`[CachedQlooService] Cache hit for cross-domain recommendations (real data)`);
          return cached.slice(0, limit);
        }
        
        console.log(`[CachedQlooService] Found cached fallback data, bypassing cache to retry API`);
        // Don't use cached fallback data, try API again
      }
    } catch (cacheError) {
      console.error(`[CachedQlooService] Error in recommendation cache lookup:`, cacheError);
      // Continue to API call despite cache errors
    }

    // Cache miss or fallback data - fetch from API with error handling
    console.log(`[CachedQlooService] Cache miss for cross-domain recommendations`);
    
    try {
      const recommendations = await super.getCrossDomainRecommendations(tags, targetDomains, limit);
      
      try {
        // Check if we got real data or fallback data
        const hasRealData = recommendations.some(rec => 
          !rec.id.startsWith('fallback-') && 
          rec.metadata?.source !== 'fallback'
        );
        
        if (hasRealData) {
          // Cache real data for 24 hours
          console.log(`[CachedQlooService] Caching real recommendations for 24 hours`);
          await cacheService.set(
            CACHE_NAMESPACES.QLOO_RECOMMENDATIONS,
            cacheKey,
            recommendations,
            24 * 60 * 60 // 24 hours
          );
        } else {
          // Cache fallback data for only 5 minutes to retry soon
          console.log(`[CachedQlooService] Caching fallback recommendations for 5 minutes only`);
          await cacheService.set(
            CACHE_NAMESPACES.QLOO_RECOMMENDATIONS,
            cacheKey,
            recommendations,
            5 * 60 // 5 minutes
          );
        }
      } catch (cachingError) {
        console.error(`[CachedQlooService] Error caching recommendation results:`, cachingError);
        // Continue despite cache write errors, we still have results to return
      }
      
      return recommendations;
    } catch (error) {
      console.warn(`[CachedQlooService] API call failed, attempting fallback recommendations:`, error);
      
      // If we have fallback cached data, use it even though we tried to avoid it
      if (cached && cached.length > 0) {
        console.log(`[CachedQlooService] Using cached fallback data after API error`);
        return cached.slice(0, limit);
      }
      
      // Try to get fallback recommendations from cache or default data
      const fallbackRecommendations = await this.getFallbackRecommendations(tags, targetDomains, limit);
      
      // Cache the fallback for very short duration (2 minutes)
      if (fallbackRecommendations.length > 0) {
        await cacheService.set(
          CACHE_NAMESPACES.QLOO_RECOMMENDATIONS,
          `fallback_${cacheKey}`,
          fallbackRecommendations,
          60 * 60 // 1 hour for fallback data
        );
      }
      
      return fallbackRecommendations;
    }
  }

  /**
   * Get fallback recommendations when API fails
   */
  private async getFallbackRecommendations(
    tags: QlooTag[], 
    targetDomains: string[], 
    limit: number
  ): Promise<QlooRecommendation[]> {
    console.log(`[CachedQlooService] Generating fallback recommendations for ${targetDomains.length} domains`);
    
    // Generate simple fallback recommendations based on tags
    const fallbackRecommendations: QlooRecommendation[] = [];
    
    for (const domain of targetDomains) {
      // Create a few simple recommendations per domain
      for (let i = 0; i < Math.min(limit, 3); i++) {
        fallbackRecommendations.push({
          id: `fallback-${domain}-${i}-${Date.now()}`,
          name: `Popular ${domain} recommendation ${i + 1}`,
          type: domain,
          confidence: 0.3 + (Math.random() * 0.2), // 0.3-0.5 confidence
          metadata: {
            fallback: true,
            source: 'cached-qloo-service',
            tags: tags.slice(0, 2).map(t => t.name),
            reason: 'API service unavailable'
          }
        });
      }
    }
    
    return fallbackRecommendations;
  }

  /**
   * Get entity recommendations with caching - DEPRECATED
   * Note: This method signature doesn't match the parent class
   */
  async getEntityRecommendationsLegacy(
    entityId: string, 
    targetDomains: string[], 
    limit: number = 10
  ): Promise<QlooRecommendation[]> {
    // This method is kept for backward compatibility but should not be used
    console.warn('[CachedQlooService] getEntityRecommendationsLegacy is deprecated');
    return [];
  }

  /**
   * Get entity details with caching
   * Cache key: insights:{entityId} (reuse insights namespace for entity details)
   * TTL: 24 hours
   */
  async getEntityDetails(entityIds: string[]): Promise<QlooEntity[]> {
    const results: QlooEntity[] = [];
    const uncachedIds: string[] = [];
    
    // Check cache for each entity
    for (const entityId of entityIds) {
      const cached = await cacheService.get<QlooEntity>(
        CACHE_NAMESPACES.QLOO_INSIGHTS,
        `entity:${entityId}`
      );
      
      if (cached) {
        console.log(`[CachedQlooService] Cache hit for entity details: ${entityId}`);
        results.push(cached);
      } else {
        uncachedIds.push(entityId);
      }
    }
    
    // Fetch uncached entities from API
    if (uncachedIds.length > 0) {
      console.log(`[CachedQlooService] Cache miss for entity details: ${uncachedIds.join(', ')}`);
      const fetchedEntities = await super.getEntityDetails(uncachedIds);
      
      // Store each entity in cache
      for (const entity of fetchedEntities) {
        await cacheService.set(
          CACHE_NAMESPACES.QLOO_INSIGHTS,
          `entity:${entity.id}`,
          entity,
          24 * 60 * 60 // 24 hours
        );
        results.push(entity);
      }
    }
    
    // Return results in the same order as requested
    return entityIds.map(id => results.find(entity => entity.id === id)).filter(Boolean) as QlooEntity[];
  }

  /**
   * Invalidate cache for a specific entity
   * Useful when entity data is updated
   */
  async invalidateEntityCache(entityId: string): Promise<void> {
    console.log(`[CachedQlooService] Invalidating cache for entity: ${entityId}`);
    
    await Promise.all([
      cacheService.delete(CACHE_NAMESPACES.QLOO_INSIGHTS, entityId),
      cacheService.delete(CACHE_NAMESPACES.QLOO_INSIGHTS, `entity:${entityId}`),
    ]);
  }

  /**
   * Invalidate all recommendation caches
   * Useful when recommendation algorithm changes
   */
  async invalidateRecommendationCache(): Promise<void> {
    console.log(`[CachedQlooService] Invalidating all recommendation caches`);
    await cacheService.clearNamespace(CACHE_NAMESPACES.QLOO_RECOMMENDATIONS);
  }

  /**
   * Invalidate all entity search caches
   * Useful when search index is updated
   */
  async invalidateSearchCache(): Promise<void> {
    console.log(`[CachedQlooService] Invalidating all search caches`);
    await cacheService.clearNamespace(CACHE_NAMESPACES.QLOO_ENTITY_SEARCH);
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats() {
    return await cacheService.getStats();
  }

  /**
   * Warm up cache with popular entities
   * This can be called during application startup
   */
  async warmupCache(popularEntities: Array<{ id: string; name: string; type: string }>): Promise<void> {
    console.log(`[CachedQlooService] Warming up cache with ${popularEntities.length} popular entities`);
    
    const warmupPromises = popularEntities.map(async (entity) => {
      try {
        // Pre-load entity insights
        await this.getEntityInsights(entity.id, entity.type);
        
        // Pre-load entity search results
        await this.searchEntity(entity.name, entity.type);
        
        console.log(`[CachedQlooService] Warmed up cache for: ${entity.name}`);
      } catch (error) {
        console.warn(`[CachedQlooService] Failed to warm up cache for ${entity.name}:`, error);
      }
    });
    
    await Promise.allSettled(warmupPromises);
    console.log(`[CachedQlooService] Cache warmup completed`);
  }
}

/**
 * Factory function to create CachedQlooService with environment configuration
 */
export function createCachedQlooService(): CachedQlooService {
  const config: QlooServiceConfig = {
    apiKey: process.env.QLOO_API_KEY || '',
    apiUrl: process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com',
    retryConfig: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 10000
    }
  };

  // Check for missing or placeholder API key
  if (!config.apiKey || 
      config.apiKey === 'your_qloo_api_key_here' || 
      config.apiKey === 'your_actual_qloo_api_key_here') {
    throw new Error(`
❌ QLOO API KEY MISSING: The application needs a valid Qloo API key to function properly.

🔧 To fix this:
1. Get your API key from: https://qloo-hackathon.devpost.com/
2. Update your .env file: QLOO_API_KEY=your_actual_key_here  
3. Restart the application

📖 See API_KEY_SETUP.md for detailed instructions.

⚠️  Without a valid API key, you'll only get fallback recommendations.
    `);
  }

  return new CachedQlooService(config);
}

/**
 * Utility functions for cache management
 */
export const CacheManagement = {
  /**
   * Clear all Qloo-related caches
   */
  async clearAllQlooCache(): Promise<void> {
    await Promise.all([
      cacheService.clearNamespace(CACHE_NAMESPACES.QLOO_INSIGHTS),
      cacheService.clearNamespace(CACHE_NAMESPACES.QLOO_RECOMMENDATIONS),
      cacheService.clearNamespace(CACHE_NAMESPACES.QLOO_ENTITY_SEARCH),
    ]);
  },

  /**
   * Get cache health specifically for Qloo services
   */
  async getQlooCacheHealth() {
    const health = await cacheService.healthCheck();
    const stats = await cacheService.getStats();
    
    return {
      healthy: health.l1 && health.l2,
      l1Cache: {
        healthy: health.l1,
        stats: { size: stats.l1Size },
      },
      l2Cache: {
        healthy: health.l2,
        stats: { connected: stats.l2Connected },
      },
      timestamp: new Date().toISOString(),
    };
  },
};