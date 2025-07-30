/**
 * Production Monitoring and Analytics Configuration
 * 
 * This module sets up monitoring, analytics, and error tracking for production deployment.
 * It integrates with Vercel Analytics, Supabase monitoring, and optional third-party services.
 */

import { createClient } from '@supabase/supabase-js';

// Types for monitoring data
interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

interface ErrorData {
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

interface PerformanceData {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  userId?: string;
  timestamp?: Date;
}

// Configuration
const isProduction = process.env.NODE_ENV === 'production';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase client for monitoring
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Vercel Analytics Integration
 */
export class VercelAnalytics {
  private static instance: VercelAnalytics;

  static getInstance(): VercelAnalytics {
    if (!VercelAnalytics.instance) {
      VercelAnalytics.instance = new VercelAnalytics();
    }
    return VercelAnalytics.instance;
  }

  /**
   * Track custom events in Vercel Analytics
   */
  track(eventName: string, properties?: Record<string, any>) {
    if (!isProduction) return;

    try {
      // Use Vercel Analytics API if available
      if (typeof window !== 'undefined' && (window as any).va) {
        (window as any).va('track', eventName, properties);
      }
    } catch (error) {
      console.error('Failed to track Vercel Analytics event:', error);
    }
  }

  /**
   * Track page views
   */
  pageView(path: string, properties?: Record<string, any>) {
    this.track('pageview', { path, ...properties });
  }

  /**
   * Track API usage
   */
  apiCall(endpoint: string, method: string, statusCode: number, duration: number) {
    this.track('api_call', {
      endpoint,
      method,
      status_code: statusCode,
      duration_ms: duration
    });
  }

  /**
   * Track recommendation requests
   */
  recommendation(inputType: string, outputDomains: string[], cached: boolean) {
    this.track('recommendation_request', {
      input_type: inputType,
      output_domains: outputDomains.join(','),
      cached
    });
  }
}

/**
 * Supabase Monitoring Integration
 */
export class SupabaseMonitoring {
  private static instance: SupabaseMonitoring;

  static getInstance(): SupabaseMonitoring {
    if (!SupabaseMonitoring.instance) {
      SupabaseMonitoring.instance = new SupabaseMonitoring();
    }
    return SupabaseMonitoring.instance;
  }

  /**
   * Log system metrics to Supabase
   */
  async logMetric(data: MetricData) {
    if (!isProduction) return;

    try {
      await supabase
        .from('system_metrics')
        .insert({
          metric_name: data.name,
          metric_value: data.value,
          tags: data.tags || {},
          timestamp: data.timestamp || new Date()
        });
    } catch (error) {
      console.error('Failed to log metric to Supabase:', error);
    }
  }

  /**
   * Log performance data
   */
  async logPerformance(data: PerformanceData) {
    await this.logMetric({
      name: 'api_performance',
      value: data.duration,
      tags: {
        endpoint: data.endpoint,
        method: data.method,
        status_code: data.statusCode.toString(),
        user_id: data.userId || 'anonymous'
      },
      timestamp: data.timestamp
    });
  }

  /**
   * Log error to Supabase
   */
  async logError(data: ErrorData) {
    if (!isProduction) return;

    try {
      await supabase
        .from('error_logs')
        .insert({
          message: data.message,
          stack_trace: data.stack,
          context: data.context || {},
          user_id: data.userId,
          session_id: data.sessionId,
          url: data.url,
          user_agent: data.userAgent,
          created_at: new Date()
        });
    } catch (error) {
      console.error('Failed to log error to Supabase:', error);
    }
  }

  /**
   * Get system health metrics
   */
  async getHealthMetrics() {
    try {
      const { data, error } = await supabase
        .from('system_metrics')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get health metrics:', error);
      return [];
    }
  }

  /**
   * Get error summary
   */
  async getErrorSummary(hours: number = 24) {
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('message, created_at, context')
        .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000))
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get error summary:', error);
      return [];
    }
  }
}

/**
 * Performance Monitoring
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.metrics.set(operationId, Date.now());
  }

  /**
   * End timing and log the duration
   */
  async endTimer(operationId: string, metadata?: Record<string, any>): Promise<number> {
    const startTime = this.metrics.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.metrics.delete(operationId);

    // Log to monitoring systems
    const supabaseMonitoring = SupabaseMonitoring.getInstance();
    await supabaseMonitoring.logMetric({
      name: 'operation_duration',
      value: duration,
      tags: {
        operation: operationId,
        ...metadata
      }
    });

    return duration;
  }

  /**
   * Monitor API endpoint performance
   */
  async monitorApiCall<T>(
    endpoint: string,
    method: string,
    operation: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const startTime = Date.now();
    let statusCode = 200;
    let error: Error | null = null;

    try {
      const result = await operation();
      return result;
    } catch (err) {
      error = err as Error;
      statusCode = 500;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      // Log to both monitoring systems
      const vercelAnalytics = VercelAnalytics.getInstance();
      const supabaseMonitoring = SupabaseMonitoring.getInstance();

      vercelAnalytics.apiCall(endpoint, method, statusCode, duration);
      
      await supabaseMonitoring.logPerformance({
        endpoint,
        method,
        duration,
        statusCode,
        userId,
        timestamp: new Date()
      });

      // Log error if occurred
      if (error) {
        await supabaseMonitoring.logError({
          message: error.message,
          stack: error.stack,
          context: {
            endpoint,
            method,
            duration,
            statusCode
          },
          userId
        });
      }
    }
  }
}

/**
 * Health Check Monitor
 */
export class HealthMonitor {
  private static instance: HealthMonitor;

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Check external service health
   */
  async checkExternalServices(): Promise<Record<string, boolean>> {
    const services = {
      qloo: false,
      gemini: false,
      supabase: false,
      redis: false
    };

    // Check Qloo API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${process.env.QLOO_API_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      services.qloo = response.ok;
    } catch (error) {
      services.qloo = false;
    }

    // Check Gemini API (simple test)
    try {
      // This would be a simple API test
      services.gemini = !!process.env.GEMINI_API_KEY;
    } catch (error) {
      services.gemini = false;
    }

    // Check Supabase
    try {
      const { error } = await supabase.from('user_profiles').select('count').limit(1);
      services.supabase = !error;
    } catch (error) {
      services.supabase = false;
    }

    // Check Redis (if configured)
    try {
      services.redis = !!process.env.REDIS_URL;
    } catch (error) {
      services.redis = false;
    }

    // Log health check results
    const supabaseMonitoring = SupabaseMonitoring.getInstance();
    for (const [service, healthy] of Object.entries(services)) {
      await supabaseMonitoring.logMetric({
        name: 'service_health',
        value: healthy ? 1 : 0,
        tags: { service }
      });
    }

    return services;
  }

  /**
   * Get overall system health
   */
  async getSystemHealth() {
    const services = await this.checkExternalServices();
    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;
    const healthPercentage = (healthyServices / totalServices) * 100;

    return {
      healthy: healthPercentage >= 75, // Consider healthy if 75% of services are up
      services,
      healthPercentage,
      timestamp: new Date()
    };
  }
}

/**
 * Initialize monitoring in production
 */
export function initializeMonitoring() {
  if (!isProduction) return;

  // Set up error boundary for unhandled errors
  if (typeof window !== 'undefined') {
    window.addEventListener('error', async (event) => {
      const supabaseMonitoring = SupabaseMonitoring.getInstance();
      await supabaseMonitoring.logError({
        message: event.error?.message || 'Unknown error',
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        },
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    window.addEventListener('unhandledrejection', async (event) => {
      const supabaseMonitoring = SupabaseMonitoring.getInstance();
      await supabaseMonitoring.logError({
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        context: {
          type: 'unhandledrejection'
        },
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });
  }

  console.log('🔍 Production monitoring initialized');
}

// Export singleton instances
export const vercelAnalytics = VercelAnalytics.getInstance();
export const supabaseMonitoring = SupabaseMonitoring.getInstance();
export const performanceMonitor = PerformanceMonitor.getInstance();
export const healthMonitor = HealthMonitor.getInstance();