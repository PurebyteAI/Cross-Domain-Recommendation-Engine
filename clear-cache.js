#!/usr/bin/env node

/**
 * Cache Clear Utility
 * Use this to clear cached fallback data and force fresh API calls
 */

const { createClient } = require('redis');
require('dotenv').config();

async function clearCache() {
  console.log('🧹 Clearing recommendation cache...');
  
  try {
    // If using Redis
    if (process.env.REDIS_URL) {
      const redis = createClient({
        url: process.env.REDIS_URL
      });
      
      await redis.connect();
      
      // Clear all recommendation caches
      const keys = await redis.keys('cdre:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`✅ Cleared ${keys.length} cached items from Redis`);
      } else {
        console.log('ℹ️  No cached items found in Redis');
      }
      
      await redis.disconnect();
    } else {
      console.log('ℹ️  No Redis configured, using in-memory cache (automatically cleared on restart)');
      console.log('💡 To clear in-memory cache, restart your dev server: npm run dev');
    }
    
    console.log('🎉 Cache cleared! Next recommendation requests will use fresh API calls.');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    console.log('💡 You can also restart your dev server to clear in-memory cache');
  }
}

async function main() {
  console.log('🚀 Cache Clear Utility\n');
  await clearCache();
}

main().catch(console.error);
