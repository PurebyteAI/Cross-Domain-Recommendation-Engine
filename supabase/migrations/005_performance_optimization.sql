-- Performance optimization migration
-- Add indexes, connection pooling settings, and new columns for personalization

-- Add learned preferences column to user profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS learned_preferences JSONB,
ADD COLUMN IF NOT EXISTS preferences_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed);

CREATE INDEX IF NOT EXISTS idx_user_taste_history_user_id ON user_taste_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_taste_history_created_at ON user_taste_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_taste_history_session_id ON user_taste_history(session_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);

CREATE INDEX IF NOT EXISTS idx_cached_explanations_hashes ON cached_explanations(input_entity_hash, recommended_entity_hash);
CREATE INDEX IF NOT EXISTS idx_cached_explanations_expires_at ON cached_explanations(expires_at);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_taste_history_user_created ON user_taste_history(user_id, created_at DESC);

-- Create function for connection count monitoring
CREATE OR REPLACE FUNCTION get_connection_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT count(*)
    FROM pg_stat_activity
    WHERE state = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for database optimization
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get or create user profile (upsert)
CREATE OR REPLACE FUNCTION get_or_create_user_profile(
  clerk_id TEXT,
  user_email TEXT,
  user_display_name TEXT DEFAULT NULL
)
RETURNS user_profiles AS $$
DECLARE
  user_record user_profiles;
BEGIN
  -- Try to get existing user
  SELECT * INTO user_record
  FROM user_profiles
  WHERE clerk_user_id = clerk_id;
  
  -- If user doesn't exist, create them
  IF NOT FOUND THEN
    INSERT INTO user_profiles (clerk_user_id, email, display_name)
    VALUES (clerk_id, user_email, user_display_name)
    RETURNING * INTO user_record;
  END IF;
  
  RETURN user_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check user usage limit
CREATE OR REPLACE FUNCTION check_user_usage_limit(clerk_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_record user_profiles;
  daily_usage INTEGER;
BEGIN
  -- Get user profile
  SELECT * INTO user_record
  FROM user_profiles
  WHERE clerk_user_id = clerk_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get today's usage
  SELECT COALESCE(SUM(request_count), 0) INTO daily_usage
  FROM api_usage
  WHERE user_id = user_record.id
    AND date = CURRENT_DATE;
  
  -- Check if under limit
  RETURN daily_usage < user_record.usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup expired explanations
CREATE OR REPLACE FUNCTION cleanup_expired_explanations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cached_explanations
  WHERE expires_at < NOW()
  RETURNING count(*) INTO deleted_count;
  
  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create materialized view for user analytics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_analytics AS
SELECT 
  up.id,
  up.clerk_user_id,
  up.tier,
  up.created_at as user_created_at,
  COUNT(uth.id) as total_recommendations,
  COUNT(DISTINCT DATE(uth.created_at)) as active_days,
  AVG(au.response_time_ms) as avg_response_time,
  SUM(au.request_count) as total_requests,
  MAX(uth.created_at) as last_recommendation_at
FROM user_profiles up
LEFT JOIN user_taste_history uth ON up.id = uth.user_id
LEFT JOIN api_usage au ON up.id = au.user_id
GROUP BY up.id, up.clerk_user_id, up.tier, up.created_at;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_analytics_id ON user_analytics(id);

-- Create function to refresh user analytics
CREATE OR REPLACE FUNCTION refresh_user_analytics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for new columns
CREATE POLICY "Users can view own learned preferences" ON user_profiles
  FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own learned preferences" ON user_profiles
  FOR UPDATE USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Create table for background job tracking
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payload JSONB,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- Add indexes for background jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON background_jobs(created_at DESC);

-- Create function to enqueue background job
CREATE OR REPLACE FUNCTION enqueue_background_job(
  job_type TEXT,
  job_payload JSONB DEFAULT NULL,
  max_retries INTEGER DEFAULT 3
)
RETURNS UUID AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO background_jobs (job_type, payload, max_retries)
  VALUES (job_type, job_payload, max_retries)
  RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_id UUID REFERENCES user_profiles(id),
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Add indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);

-- Create function to record performance metric
CREATE OR REPLACE FUNCTION record_performance_metric(
  endpoint_path TEXT,
  http_method TEXT,
  response_time INTEGER,
  status_code INTEGER,
  user_id UUID DEFAULT NULL,
  metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO performance_metrics (endpoint, method, response_time_ms, status_code, user_id, metadata)
  VALUES (endpoint_path, http_method, response_time, status_code, user_id, metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON user_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_count() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_analytics() TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'User profiles with learned preferences and onboarding status';
COMMENT ON TABLE background_jobs IS 'Queue for background job processing';
COMMENT ON TABLE performance_metrics IS 'Performance monitoring and analytics';
COMMENT ON MATERIALIZED VIEW user_analytics IS 'Aggregated user analytics for dashboard';

-- Optimize table storage
ALTER TABLE user_taste_history SET (fillfactor = 90);
ALTER TABLE api_usage SET (fillfactor = 90);
ALTER TABLE cached_explanations SET (fillfactor = 85);
ALTER TABLE system_metrics SET (fillfactor = 85);

-- Add table statistics for query planner
ANALYZE user_profiles;
ANALYZE user_taste_history;
ANALYZE api_usage;
ANALYZE cached_explanations;
ANALYZE system_metrics;