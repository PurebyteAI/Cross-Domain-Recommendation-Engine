# Database Setup Guide

This guide explains how to set up the Supabase database schema and Row Level Security (RLS) policies for the Cross-Domain Recommendation Engine.

## Overview

The database schema includes:
- **User Profiles**: Extends Clerk user data with usage limits and tiers
- **User Taste History**: Stores recommendation requests and results
- **API Usage Tracking**: Monitors usage for rate limiting and analytics
- **Cached Explanations**: Stores generated explanations for performance
- **System Metrics**: Application performance and monitoring data

## Quick Setup

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   
   Find your project ref in your Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

4. **Apply migrations**:
   ```bash
   supabase db push
   ```

### Option 2: Manual Setup via Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and execute the contents of `supabase/migrations/001_initial_schema.sql`
4. Copy and execute the contents of `supabase/migrations/002_rls_policies.sql`

## Verification

Check if your database is set up correctly:

```bash
node scripts/check-database-status.js
```

Run comprehensive database tests:

```bash
node scripts/test-database-setup.js
```

## Database Schema

### Tables

#### `user_profiles`
Extends Clerk user data with application-specific information.

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    usage_limit INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `user_taste_history`
Stores user recommendation requests and results.

```sql
CREATE TABLE user_taste_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    input_entity JSONB NOT NULL,
    recommendations JSONB NOT NULL,
    session_id VARCHAR(255),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `api_usage`
Tracks API usage for rate limiting and analytics.

```sql
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    response_time_ms INTEGER,
    status_code INTEGER,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `cached_explanations`
Stores generated explanations for performance optimization.

```sql
CREATE TABLE cached_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_entity_hash VARCHAR(255) NOT NULL,
    recommended_entity_hash VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(input_entity_hash, recommended_entity_hash)
);
```

#### `system_metrics`
Application performance and monitoring data.

```sql
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    tags JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Row Level Security (RLS)

All user-related tables have RLS enabled with the following policies:

### User Profiles
- Users can view/update their own profile
- Service role can access all profiles

### User Taste History
- Users can view/insert their own taste history
- Service role can access all taste history

### API Usage
- Users can view/insert their own usage data
- Service role can access all usage data

### Cached Explanations
- All authenticated users can read cached explanations (shared resource)
- Only service role can insert/update cached explanations

### System Metrics
- Only service role can access system metrics

## Database Functions

### `get_or_create_user_profile(clerk_id, user_email, user_display_name)`
Gets an existing user profile or creates a new one.

### `check_user_usage_limit(clerk_id, current_date)`
Checks if a user is under their daily usage limit.

### `cleanup_expired_explanations()`
Removes expired cached explanations.

## Performance Indexes

The schema includes optimized indexes for:
- User lookups by Clerk ID
- Taste history queries by user and date
- API usage tracking by user and date
- Cached explanation lookups by entity hashes
- System metrics by name and timestamp

## Environment Variables

Ensure these environment variables are set:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage in Code

The database services are available through the `database.ts` module:

```typescript
import { 
  UserProfileService,
  UserTasteHistoryService,
  ApiUsageService,
  CachedExplanationService,
  SystemMetricsService
} from '@/lib/database'

// Get or create user profile
const profile = await UserProfileService.getOrCreate(
  clerkUserId,
  email,
  displayName
)

// Record taste history
const history = await UserTasteHistoryService.create({
  user_id: profile.data.id,
  input_entity: { name: 'Radiohead', type: 'artist' },
  recommendations: recommendations,
  session_id: sessionId
})
```

## Troubleshooting

### Common Issues

1. **"relation does not exist" error**: Run the migrations
2. **RLS policy violations**: Ensure proper authentication context
3. **Connection errors**: Check environment variables

### Getting Help

- Check the database status: `node scripts/check-database-status.js`
- Run integration tests: `node scripts/test-database-setup.js`
- Review Supabase logs in the dashboard
- Check the application logs for detailed error messages