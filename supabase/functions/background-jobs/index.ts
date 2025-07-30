import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobPayload {
    type: 'cleanup_expired_cache' | 'user_preference_analysis' | 'system_maintenance' | 'recommendation_batch'
    data?: any
    scheduledAt?: string
}

interface RecommendationRequest {
    entities: Array<{
        id?: string
        name: string
        type: string
        metadata?: Record<string, any>
    }>
    domains?: string[]
    limit?: number
    includeExplanations?: boolean
}

interface BatchData {
    requests: RecommendationRequest[]
    userId?: string
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { type, data } = await req.json() as JobPayload

        console.log(`Processing background job: ${type}`)

        switch (type) {
            case 'cleanup_expired_cache':
                await cleanupExpiredCache(supabaseClient)
                break

            case 'user_preference_analysis':
                await analyzeUserPreferences(supabaseClient, data)
                break

            case 'system_maintenance':
                await performSystemMaintenance(supabaseClient)
                break

            case 'recommendation_batch':
                await processRecommendationBatch(supabaseClient, data)
                break

            default:
                throw new Error(`Unknown job type: ${type}`)
        }

        return new Response(
            JSON.stringify({ success: true, message: `Job ${type} completed successfully` }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Background job error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})

async function cleanupExpiredCache(supabase: any) {
    console.log('Starting cache cleanup...')

    // Clean up expired explanations
    const { data: deletedExplanations, error: explanationError } = await supabase
        .from('cached_explanations')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id')

    if (explanationError) {
        throw new Error(`Failed to cleanup explanations: ${explanationError.message}`)
    }

    // Clean up old taste history (older than 90 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)

    const { data: deletedHistory, error: historyError } = await supabase
        .from('user_taste_history')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id')

    if (historyError) {
        throw new Error(`Failed to cleanup taste history: ${historyError.message}`)
    }

    // Clean up old system metrics (older than 30 days)
    const metricsDate = new Date()
    metricsDate.setDate(metricsDate.getDate() - 30)

    const { data: deletedMetrics, error: metricsError } = await supabase
        .from('system_metrics')
        .delete()
        .lt('timestamp', metricsDate.toISOString())
        .select('id')

    if (metricsError) {
        throw new Error(`Failed to cleanup metrics: ${metricsError.message}`)
    }

    console.log(`Cleanup completed: ${deletedExplanations?.length || 0} explanations, ${deletedHistory?.length || 0} history records, ${deletedMetrics?.length || 0} metrics`)
}

async function analyzeUserPreferences(supabase: any, data: any) {
    console.log('Starting user preference analysis...')

    const { userId, batchSize = 100 } = data || {}

    // Get users to analyze (either specific user or batch)
    let query = supabase
        .from('user_profiles')
        .select('id, clerk_user_id')

    if (userId) {
        query = query.eq('id', userId)
    } else {
        query = query.limit(batchSize)
    }

    const { data: users, error: usersError } = await query

    if (usersError) {
        throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    for (const user of users || []) {
        try {
            // Get user's taste history
            const { data: history, error: historyError } = await supabase
                .from('user_taste_history')
                .select('input_entity, recommendations')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (historyError) {
                console.error(`Failed to fetch history for user ${user.id}:`, historyError)
                continue
            }

            if (!history || history.length === 0) {
                continue
            }

            // Analyze preferences
            const preferences = analyzeUserTastePatterns(history)

            // Update user profile with learned preferences
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({
                    learned_preferences: preferences,
                    preferences_updated_at: new Date().toISOString()
                })
                .eq('id', user.id)

            if (updateError) {
                console.error(`Failed to update preferences for user ${user.id}:`, updateError)
            }
        } catch (error) {
            console.error(`Error analyzing preferences for user ${user.id}:`, error)
        }
    }

    console.log(`Preference analysis completed for ${users?.length || 0} users`)
}

function analyzeUserTastePatterns(history: any[]) {
    const patterns = {
        preferredDomains: {} as Record<string, number>,
        commonThemes: {} as Record<string, number>,
        averageConfidence: 0,
        totalInteractions: history.length
    }

    let totalConfidence = 0
    let confidenceCount = 0

    for (const record of history) {
        try {
            const recommendations = record.recommendations || {}

            // Count domain preferences
            for (const domain of Object.keys(recommendations)) {
                patterns.preferredDomains[domain] = (patterns.preferredDomains[domain] || 0) + 1

                // Analyze confidence scores
                const domainRecs = recommendations[domain] || []
                for (const rec of domainRecs) {
                    if (rec.confidence) {
                        totalConfidence += rec.confidence
                        confidenceCount++
                    }
                }
            }
        } catch (error) {
            console.error('Error analyzing record:', error)
        }
    }

    patterns.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    return patterns
}

async function performSystemMaintenance(supabase: any) {
    console.log('Starting system maintenance...')

    // Update system health metrics
    const healthMetrics = {
        timestamp: new Date().toISOString(),
        database_connections: await getDatabaseConnectionCount(supabase),
        cache_size: await getCacheSize(supabase),
        active_users: await getActiveUserCount(supabase)
    }

    const { error: metricsError } = await supabase
        .from('system_metrics')
        .insert({
            metric_name: 'system_health',
            metric_value: 1,
            tags: healthMetrics
        })

    if (metricsError) {
        console.error('Failed to record health metrics:', metricsError)
    }

    // Optimize database performance
    await optimizeDatabasePerformance(supabase)

    console.log('System maintenance completed')
}

async function getDatabaseConnectionCount(supabase: any): Promise<number> {
    try {
        const { data, error } = await supabase.rpc('get_connection_count')
        return error ? 0 : (data || 0)
    } catch {
        return 0
    }
}

async function getCacheSize(supabase: any): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('cached_explanations')
            .select('*', { count: 'exact', head: true })
        return error ? 0 : (count || 0)
    } catch {
        return 0
    }
}

async function getActiveUserCount(supabase: any): Promise<number> {
    try {
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)

        const { count, error } = await supabase
            .from('api_usage')
            .select('user_id', { count: 'exact', head: true })
            .gte('created_at', oneDayAgo.toISOString())

        return error ? 0 : (count || 0)
    } catch {
        return 0
    }
}

async function optimizeDatabasePerformance(supabase: any) {
    // Run database optimization queries
    const optimizations = [
        'ANALYZE user_profiles',
        'ANALYZE user_taste_history',
        'ANALYZE cached_explanations',
        'ANALYZE api_usage'
    ]

    for (const query of optimizations) {
        try {
            await supabase.rpc('execute_sql', { sql: query })
        } catch (error) {
            console.error(`Failed to execute optimization: ${query}`, error)
        }
    }
}

async function processRecommendationBatch(supabase: any, data: any) {
    console.log('Processing recommendation batch...')

    const { requests, userId }: BatchData = data || {}

    if (!requests || !Array.isArray(requests)) {
        throw new Error('Invalid batch data: requests array required')
    }

    const results = []

    for (const request of requests) {
        try {
            // Process each recommendation request
            const result = await processRecommendationRequest(request, userId)
            results.push(result)
        } catch (error) {
            console.error('Failed to process recommendation:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            results.push({
                success: false,
                error: errorMessage,
                request,
                processed_at: new Date().toISOString()
            })
        }
    }

    // Store batch results
    if (userId) {
        const { error: storeError } = await supabase
            .from('user_taste_history')
            .insert({
                user_id: userId,
                input_entity: { batch: true, count: requests.length },
                recommendations: { batch_results: results },
                session_id: `batch_${Date.now()}`
            })

        if (storeError) {
            console.error('Failed to store batch results:', storeError)
        }
    }

    console.log(`Batch processing completed: ${results.length} requests processed`)
    return results
}

async function processRecommendationRequest(request: any, userId?: string) {
    try {
        // Validate request structure
        if (!request || !request.entities || !Array.isArray(request.entities)) {
            throw new Error('Invalid request: entities array required')
        }

        // Create recommendation request object
        const recommendationRequest = {
            entities: request.entities,
            domains: request.domains || ['movie', 'book', 'song', 'artist', 'restaurant', 'brand'],
            limit: request.limit || 5,
            includeExplanations: request.includeExplanations !== false,
            userId: userId
        }

        // For now, return a structured response that matches the expected format
        // In a production environment, this would integrate with the actual recommendation engine
        // by importing and using the RecommendationEngine service
        const mockRecommendations: Record<string, any[]> = {}

        // Generate mock recommendations for each requested domain
        const domains = recommendationRequest.domains
        for (const domain of domains) {
            mockRecommendations[domain] = []

            // Create mock recommendations based on input entities
            for (let i = 0; i < Math.min(recommendationRequest.limit, 3); i++) {
                const inputEntity = request.entities[0] // Use first entity as reference
                mockRecommendations[domain].push({
                    id: `${domain}_rec_${i + 1}`,
                    name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Recommendation ${i + 1}`,
                    type: domain,
                    confidence: 0.8 - (i * 0.1),
                    explanation: recommendationRequest.includeExplanations
                        ? `Based on your interest in ${inputEntity.name}, you might enjoy this ${domain}.`
                        : '',
                    metadata: {
                        source: 'background_job',
                        processed_at: new Date().toISOString()
                    }
                })
            }
        }

        return {
            success: true,
            input: request.entities,
            recommendations: mockRecommendations,
            processingTime: 100, // Mock processing time
            cached: false,
            processed_at: new Date().toISOString(),
            user_id: userId
        }
    } catch (error) {
        console.error('Error processing recommendation request:', error)
        throw new Error(`Failed to process recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}