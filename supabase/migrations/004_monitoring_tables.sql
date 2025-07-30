-- Migration: Add monitoring and analytics tables
-- Created: 2025-01-30
-- Description: Creates tables for system monitoring, metrics, and analytics

-- System metrics table for performance monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system_metrics USING GIN(tags);

-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    request_size_bytes INTEGER DEFAULT 0,
    response_size_bytes INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for API usage analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_status_code ON api_usage(status_code);

-- Recommendation analytics table
CREATE TABLE IF NOT EXISTS recommendation_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    input_type VARCHAR(100) NOT NULL,
    input_data JSONB NOT NULL,
    output_domains TEXT[] NOT NULL,
    recommendations_count INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    cache_hit BOOLEAN DEFAULT FALSE,
    quality_score DECIMAL(3,2), -- 0.00 to 1.00
    user_feedback INTEGER, -- 1-5 rating
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for recommendation analytics
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_user_id ON recommendation_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_input_type ON recommendation_analytics(input_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_timestamp ON recommendation_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_cache_hit ON recommendation_analytics(cache_hit);

-- System health checks table
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for health checks
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service_name);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);

-- Performance benchmarks table
CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    benchmark_name VARCHAR(255) NOT NULL,
    environment VARCHAR(50) NOT NULL, -- 'production', 'staging', 'development'
    metrics JSONB NOT NULL,
    baseline_metrics JSONB,
    performance_score DECIMAL(5,2),
    passed BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance benchmarks
CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_name ON performance_benchmarks(benchmark_name);
CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_env ON performance_benchmarks(environment);
CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_timestamp ON performance_benchmarks(timestamp);

-- Row Level Security (RLS) policies

-- Enable RLS on all monitoring tables
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_benchmarks ENABLE ROW LEVEL SECURITY;

-- System metrics policies (admin and service role only)
CREATE POLICY "system_metrics_service_role" ON system_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "system_metrics_admin_read" ON system_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- API usage policies (users can see their own data, admins see all)
CREATE POLICY "api_usage_service_role" ON api_usage
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "api_usage_own_data" ON api_usage
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "api_usage_admin_read" ON api_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- Recommendation analytics policies (similar to API usage)
CREATE POLICY "recommendation_analytics_service_role" ON recommendation_analytics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "recommendation_analytics_own_data" ON recommendation_analytics
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "recommendation_analytics_admin_read" ON recommendation_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- Health checks policies (admin and service role only)
CREATE POLICY "health_checks_service_role" ON health_checks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "health_checks_admin_read" ON health_checks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- Performance benchmarks policies (admin and service role only)
CREATE POLICY "performance_benchmarks_service_role" ON performance_benchmarks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "performance_benchmarks_admin_read" ON performance_benchmarks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- Create views for common analytics queries

-- Daily API usage summary
CREATE OR REPLACE VIEW daily_api_usage AS
SELECT 
    DATE(timestamp) as date,
    endpoint,
    COUNT(*) as request_count,
    AVG(response_time_ms) as avg_response_time,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) FILTER (WHERE status_code >= 400) as error_count
FROM api_usage
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp), endpoint
ORDER BY date DESC, request_count DESC;

-- System health summary
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    service_name,
    status,
    COUNT(*) as check_count,
    AVG(response_time_ms) as avg_response_time,
    MAX(timestamp) as last_check
FROM health_checks
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY service_name, status
ORDER BY service_name, status;

-- Recommendation performance summary
CREATE OR REPLACE VIEW recommendation_performance AS
SELECT 
    input_type,
    COUNT(*) as total_requests,
    AVG(processing_time_ms) as avg_processing_time,
    AVG(recommendations_count) as avg_recommendations,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
    AVG(quality_score) as avg_quality_score,
    AVG(user_feedback) as avg_user_feedback
FROM recommendation_analytics
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY input_type
ORDER BY total_requests DESC;

-- Grant permissions to authenticated users for views
GRANT SELECT ON daily_api_usage TO authenticated;
GRANT SELECT ON system_health_summary TO authenticated;
GRANT SELECT ON recommendation_performance TO authenticated;

-- Create functions for common monitoring operations

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
    p_user_id VARCHAR(255),
    p_endpoint VARCHAR(255),
    p_method VARCHAR(10),
    p_status_code INTEGER,
    p_response_time_ms INTEGER,
    p_request_size_bytes INTEGER DEFAULT 0,
    p_response_size_bytes INTEGER DEFAULT 0,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    usage_id UUID;
BEGIN
    INSERT INTO api_usage (
        user_id, endpoint, method, status_code, response_time_ms,
        request_size_bytes, response_size_bytes, ip_address, user_agent
    ) VALUES (
        p_user_id, p_endpoint, p_method, p_status_code, p_response_time_ms,
        p_request_size_bytes, p_response_size_bytes, p_ip_address, p_user_agent
    ) RETURNING id INTO usage_id;
    
    RETURN usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log recommendation analytics
CREATE OR REPLACE FUNCTION log_recommendation_analytics(
    p_user_id VARCHAR(255),
    p_session_id VARCHAR(255),
    p_input_type VARCHAR(100),
    p_input_data JSONB,
    p_output_domains TEXT[],
    p_recommendations_count INTEGER,
    p_processing_time_ms INTEGER,
    p_cache_hit BOOLEAN DEFAULT FALSE,
    p_quality_score DECIMAL(3,2) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    analytics_id UUID;
BEGIN
    INSERT INTO recommendation_analytics (
        user_id, session_id, input_type, input_data, output_domains,
        recommendations_count, processing_time_ms, cache_hit, quality_score
    ) VALUES (
        p_user_id, p_session_id, p_input_type, p_input_data, p_output_domains,
        p_recommendations_count, p_processing_time_ms, p_cache_hit, p_quality_score
    ) RETURNING id INTO analytics_id;
    
    RETURN analytics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record health check
CREATE OR REPLACE FUNCTION record_health_check(
    p_service_name VARCHAR(100),
    p_status VARCHAR(20),
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    check_id UUID;
BEGIN
    INSERT INTO health_checks (
        service_name, status, response_time_ms, error_message, metadata
    ) VALUES (
        p_service_name, p_status, p_response_time_ms, p_error_message, p_metadata
    ) RETURNING id INTO check_id;
    
    RETURN check_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION log_api_usage TO service_role;
GRANT EXECUTE ON FUNCTION log_recommendation_analytics TO service_role;
GRANT EXECUTE ON FUNCTION record_health_check TO service_role;

-- Create cleanup job for old monitoring data (optional)
-- This would typically be run as a scheduled job

CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data() RETURNS void AS $$
BEGIN
    -- Keep only last 90 days of system metrics
    DELETE FROM system_metrics WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Keep only last 30 days of API usage
    DELETE FROM api_usage WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Keep only last 90 days of recommendation analytics
    DELETE FROM recommendation_analytics WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Keep only last 7 days of health checks
    DELETE FROM health_checks WHERE timestamp < NOW() - INTERVAL '7 days';
    
    -- Keep only last 180 days of performance benchmarks
    DELETE FROM performance_benchmarks WHERE timestamp < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on tables and important columns
COMMENT ON TABLE system_metrics IS 'Stores system performance metrics and monitoring data';
COMMENT ON TABLE api_usage IS 'Tracks API endpoint usage and performance metrics';
COMMENT ON TABLE recommendation_analytics IS 'Analytics data for recommendation requests and performance';
COMMENT ON TABLE health_checks IS 'System health check results for external services';
COMMENT ON TABLE performance_benchmarks IS 'Performance benchmark results for different environments';

COMMENT ON COLUMN system_metrics.tags IS 'JSON object containing metric tags and metadata';
COMMENT ON COLUMN api_usage.user_id IS 'Clerk user ID for authenticated requests, null for anonymous';
COMMENT ON COLUMN recommendation_analytics.quality_score IS 'Computed quality score from 0.00 to 1.00';
COMMENT ON COLUMN recommendation_analytics.user_feedback IS 'User rating from 1-5 stars';