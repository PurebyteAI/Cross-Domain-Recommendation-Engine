/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically called by Next.js when the application starts.
 * It's used to initialize monitoring, analytics, and other production services.
 */

export async function register() {
  // Only run in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  console.log('🚀 Initializing production instrumentation...');

  try {
    // Initialize monitoring
    const { initializeMonitoring } = await import('@/lib/monitoring');
    initializeMonitoring();

    // Log startup metrics
    const { supabaseMonitoring } = await import('@/lib/monitoring');
    await supabaseMonitoring.logMetric({
      name: 'app_startup',
      value: 1,
      tags: {
        environment: process.env.NODE_ENV || 'unknown',
        version: process.env.npm_package_version || 'unknown',
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ Production instrumentation initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize production instrumentation:', error);
  }
}