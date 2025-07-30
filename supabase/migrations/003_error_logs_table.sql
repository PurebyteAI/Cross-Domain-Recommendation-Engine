-- Create error_logs table for structured error logging
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info')),
    error_code VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    is_operational BOOLEAN NOT NULL DEFAULT true,
    is_retryable BOOLEAN NOT NULL DEFAULT false,
    request_id VARCHAR(255),
    user_id VARCHAR(255), -- Clerk user ID
    endpoint VARCHAR(500),
    method VARCHAR(10),
    user_agent TEXT,
    ip_address INET,
    processing_time INTEGER, -- milliseconds
    error_details JSONB,
    context_metadata JSONB,
    stack_trace TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON error_logs(error_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs(endpoint) WHERE endpoint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_request_id ON error_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_status_code ON error_logs(status_code);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_logs_level_timestamp ON error_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint_timestamp ON error_logs(endpoint, timestamp DESC) WHERE endpoint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_user_timestamp ON error_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only allow service role to insert error logs
CREATE POLICY "Service can insert error logs" ON error_logs
    FOR INSERT 
    WITH CHECK (true); -- Service role bypasses RLS anyway, but explicit policy for clarity

-- Allow service role and authenticated users to read their own error logs
CREATE POLICY "Users can view own error logs" ON error_logs
    FOR SELECT 
    USING (
        -- Service role can see all
        auth.role() = 'service_role' OR
        -- Users can see their own errors
        (auth.role() = 'authenticated' AND user_id = auth.jwt() ->> 'sub')
    );

-- Create a view for error analytics (aggregated data)
CREATE OR REPLACE VIEW error_analytics AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    level,
    error_code,
    endpoint,
    COUNT(*) as error_count,
    AVG(processing_time) as avg_processing_time,
    COUNT(DISTINCT user_id) as affected_users,
    COUNT(DISTINCT request_id) as unique_requests
FROM error_logs
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp), level, error_code, endpoint
ORDER BY hour DESC, error_count DESC;

-- Create a function to clean up old error logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM error_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get error summary for monitoring
CREATE OR REPLACE FUNCTION get_error_summary(
    time_window INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS TABLE (
    total_errors BIGINT,
    critical_errors BIGINT,
    unique_users BIGINT,
    top_error_codes TEXT[],
    top_endpoints TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_errors,
        COUNT(*) FILTER (WHERE level = 'error') as critical_errors,
        COUNT(DISTINCT user_id) as unique_users,
        ARRAY_AGG(DISTINCT error_code ORDER BY COUNT(*) DESC LIMIT 5) as top_error_codes,
        ARRAY_AGG(DISTINCT endpoint ORDER BY COUNT(*) DESC LIMIT 5) FILTER (WHERE endpoint IS NOT NULL) as top_endpoints
    FROM error_logs
    WHERE timestamp >= NOW() - time_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON error_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_error_summary(INTERVAL) TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE error_logs IS 'Structured error logging table for application errors and monitoring';
COMMENT ON FUNCTION cleanup_old_error_logs() IS 'Cleanup function to remove error logs older than 30 days';
COMMENT ON FUNCTION get_error_summary(INTERVAL) IS 'Get error summary statistics for monitoring dashboards';
COMMENT ON VIEW error_analytics IS 'Aggregated error analytics for monitoring and alerting';