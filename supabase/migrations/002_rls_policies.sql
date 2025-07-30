-- Enable Row Level Security on all user-related tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_taste_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Cached explanations and system metrics are shared resources, no RLS needed
-- But we'll add RLS to cached_explanations for potential future user-specific caching
ALTER TABLE cached_explanations ENABLE ROW LEVEL SECURITY;

-- User Profiles RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (
        clerk_user_id = auth.jwt() ->> 'sub'
    );

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (
        clerk_user_id = auth.jwt() ->> 'sub'
    );

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (
        clerk_user_id = auth.jwt() ->> 'sub'
    );

-- Service role can access all profiles
CREATE POLICY "Service role can access all profiles" ON user_profiles
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- User Taste History RLS Policies
CREATE POLICY "Users can view own taste history" ON user_taste_history
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can insert own taste history" ON user_taste_history
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

-- Service role can access all taste history
CREATE POLICY "Service role can access all taste history" ON user_taste_history
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- API Usage RLS Policies
CREATE POLICY "Users can view own api usage" ON api_usage
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can insert own api usage" ON api_usage
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

-- Service role can access all api usage
CREATE POLICY "Service role can access all api usage" ON api_usage
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Cached Explanations RLS Policies
-- Allow all authenticated users to read cached explanations (shared resource)
CREATE POLICY "Authenticated users can read cached explanations" ON cached_explanations
    FOR SELECT USING (
        auth.role() = 'authenticated' OR auth.role() = 'service_role'
    );

-- Only service role can insert/update cached explanations
CREATE POLICY "Service role can manage cached explanations" ON cached_explanations
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- System Metrics - only service role access
CREATE POLICY "Service role can access system metrics" ON system_metrics
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Create helper functions for common queries
CREATE OR REPLACE FUNCTION get_user_profile_by_clerk_id(clerk_id TEXT)
RETURNS user_profiles AS $$
DECLARE
    profile user_profiles;
BEGIN
    SELECT * INTO profile FROM user_profiles WHERE clerk_user_id = clerk_id;
    RETURN profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_user_profile(
    clerk_id TEXT,
    user_email TEXT,
    user_display_name TEXT DEFAULT NULL
)
RETURNS user_profiles AS $$
DECLARE
    profile user_profiles;
BEGIN
    -- Try to get existing profile
    SELECT * INTO profile FROM user_profiles WHERE clerk_user_id = clerk_id;
    
    -- If not found, create new profile
    IF profile IS NULL THEN
        INSERT INTO user_profiles (clerk_user_id, email, display_name)
        VALUES (clerk_id, user_email, user_display_name)
        RETURNING * INTO profile;
    END IF;
    
    RETURN profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user usage limits
CREATE OR REPLACE FUNCTION check_user_usage_limit(clerk_id TEXT, check_date DATE DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    profile user_profiles;
    daily_usage INTEGER;
    target_date DATE;
BEGIN
    -- Get user profile
    SELECT * INTO profile FROM user_profiles WHERE clerk_user_id = clerk_id;
    
    IF profile IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Use provided date or current date
    target_date := COALESCE(check_date, CURRENT_DATE);
    
    -- Get daily usage count
    SELECT COALESCE(SUM(request_count), 0) INTO daily_usage
    FROM api_usage 
    WHERE user_id = profile.id AND date = target_date;
    
    -- Check if under limit
    RETURN daily_usage < profile.usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;