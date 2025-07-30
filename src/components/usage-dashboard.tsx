'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

interface UsageStats {
  minute: { used: number; limit: number; resetTime: number }
  hour: { used: number; limit: number; resetTime: number }
  day: { used: number; limit: number; resetTime: number }
  tier: string
}

interface Analytics {
  totalRequests: number
  requestsToday: number
  averageResponseTime: number
  errorRate: number
  topEndpoints: Array<{ endpoint: string; count: number }>
  requestsByHour: Array<{ hour: string; count: number }>
  requestsByTier: Record<string, number>
  responseTimePercentiles: {
    p50: number
    p95: number
    p99: number
  }
}

interface UsageData {
  currentUsage: UsageStats
  analytics: Analytics
  generatedAt: string
}

export function UsageDashboard() {
  const { user } = useUser()
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/user/usage')
      
      if (!response.ok) {
        // If the API fails, provide some fallback data
        if (response.status === 401) {
          throw new Error('Please sign in to view usage analytics')
        }
        throw new Error(`API Error ${response.status}: Failed to fetch usage data`)
      }
      
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch usage data')
      }

      setUsageData(result.data)
      setError(null)
    } catch (err) {
      console.error('Usage data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // Provide fallback data for development/demo purposes
      if (process.env.NODE_ENV === 'development') {
        setUsageData({
          currentUsage: {
            minute: { used: 2, limit: 10, resetTime: Date.now() + 60000 },
            hour: { used: 15, limit: 100, resetTime: Date.now() + 3600000 },
            day: { used: 45, limit: 500, resetTime: Date.now() + 86400000 },
            tier: 'free'
          },
          analytics: {
            totalRequests: 127,
            requestsToday: 45,
            averageResponseTime: 245,
            errorRate: 2.3,
            topEndpoints: [
              { endpoint: '/api/v1/recommendations', count: 34 },
              { endpoint: '/api/health', count: 12 },
              { endpoint: '/api/user/profile', count: 8 }
            ],
            requestsByHour: [
              { hour: '14', count: 5 },
              { hour: '15', count: 12 },
              { hour: '16', count: 8 },
              { hour: '17', count: 15 }
            ],
            requestsByTier: { free: 45, premium: 0, enterprise: 0 },
            responseTimePercentiles: { p50: 180, p95: 450, p99: 890 }
          },
          generatedAt: new Date().toISOString()
        })
        setError(null)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchUsageData()
  }

  const resetLimits = async () => {
    try {
      const response = await fetch('/api/user/usage', { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        await fetchUsageData() // Refresh data after reset
      } else {
        throw new Error(result.error || 'Failed to reset limits')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  useEffect(() => {
    if (user) {
      fetchUsageData()
    }
  }, [user])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="p-6 bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-slate-700 rounded"></div>
            <div className="h-3 bg-slate-700 rounded w-5/6"></div>
            <div className="h-3 bg-slate-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-800/60 backdrop-blur-md rounded-2xl border border-red-500/30 shadow-lg">
        <div className="text-red-400">
          <h3 className="text-lg font-semibold mb-2 text-slate-100">Error Loading Usage Data</h3>
          <p className="mb-4 text-red-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!usageData) {
    return null
  }

  const { currentUsage, analytics } = usageData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-100">Usage Analytics</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={resetLimits}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Reset Limits
            </button>
          )}
        </div>
      </div>

      {/* Current Usage */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-100">
          Current Usage - {currentUsage.tier.toUpperCase()} Tier
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Per Minute */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-300">Per Minute</span>
              <span className="text-sm text-slate-400">
                Resets at {formatTime(currentUsage.minute.resetTime)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(
                  getUsagePercentage(currentUsage.minute.used, currentUsage.minute.limit)
                )}`}
                style={{
                  width: `${getUsagePercentage(currentUsage.minute.used, currentUsage.minute.limit)}%`
                }}
              ></div>
            </div>
            <p className="text-sm text-slate-300">
              {currentUsage.minute.used} / {currentUsage.minute.limit} requests
            </p>
          </div>

          {/* Per Hour */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-300">Per Hour</span>
              <span className="text-sm text-slate-400">
                Resets at {formatTime(currentUsage.hour.resetTime)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(
                  getUsagePercentage(currentUsage.hour.used, currentUsage.hour.limit)
                )}`}
                style={{
                  width: `${getUsagePercentage(currentUsage.hour.used, currentUsage.hour.limit)}%`
                }}
              ></div>
            </div>
            <p className="text-sm text-slate-300">
              {currentUsage.hour.used} / {currentUsage.hour.limit} requests
            </p>
          </div>

          {/* Per Day */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-300">Per Day</span>
              <span className="text-sm text-slate-400">
                Resets at {formatTime(currentUsage.day.resetTime)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(
                  getUsagePercentage(currentUsage.day.used, currentUsage.day.limit)
                )}`}
                style={{
                  width: `${getUsagePercentage(currentUsage.day.used, currentUsage.day.limit)}%`
                }}
              ></div>
            </div>
            <p className="text-sm text-slate-300">
              {currentUsage.day.used} / {currentUsage.day.limit} requests
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-lg p-6">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Total Requests</h4>
          <p className="text-3xl font-bold text-blue-400">{analytics.totalRequests.toLocaleString()}</p>
        </div>
        
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-green-500/30 shadow-lg p-6">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Requests Today</h4>
          <p className="text-3xl font-bold text-green-400">{analytics.requestsToday.toLocaleString()}</p>
        </div>
        
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 shadow-lg p-6">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Avg Response Time</h4>
          <p className="text-3xl font-bold text-purple-400">{analytics.averageResponseTime}ms</p>
        </div>
        
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-red-500/30 shadow-lg p-6">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Error Rate</h4>
          <p className="text-3xl font-bold text-red-400">{analytics.errorRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* Top Endpoints */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-100">Top Endpoints</h3>
        {analytics.topEndpoints.length > 0 ? (
          <div className="space-y-2">
            {analytics.topEndpoints.map((endpoint, index) => (
              <div key={endpoint.endpoint} className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-slate-300">
                  {index + 1}. {endpoint.endpoint}
                </span>
                <span className="text-sm text-slate-400">{endpoint.count} requests</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">No endpoint data available</p>
        )}
      </div>

      {/* Response Time Percentiles */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-100">Response Time Percentiles</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{analytics.responseTimePercentiles.p50}ms</p>
            <p className="text-sm text-slate-400">50th percentile</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{analytics.responseTimePercentiles.p95}ms</p>
            <p className="text-sm text-slate-400">95th percentile</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{analytics.responseTimePercentiles.p99}ms</p>
            <p className="text-sm text-slate-400">99th percentile</p>
          </div>
        </div>
      </div>

      {/* Requests by Hour Chart */}
      {analytics.requestsByHour.length > 0 && (
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-100">Requests by Hour (Last 24h)</h3>
          <div className="space-y-2">
            {analytics.requestsByHour.slice(-12).map((hourData) => (
              <div key={hourData.hour} className="flex items-center space-x-4">
                <span className="text-sm text-slate-400 w-20">
                  {new Date(hourData.hour + ':00:00').toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
                <div className="flex-1 bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${Math.max((hourData.count / Math.max(...analytics.requestsByHour.map(h => h.count))) * 100, 2)}%`
                    }}
                  ></div>
                </div>
                <span className="text-sm text-slate-400 w-12">{hourData.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-slate-400">
        Last updated: {new Date(usageData.generatedAt).toLocaleString()}
      </div>
    </div>
  )
}