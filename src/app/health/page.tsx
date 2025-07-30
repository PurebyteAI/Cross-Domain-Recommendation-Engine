'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Database, Zap, Brain, Server } from 'lucide-react'
import Link from 'next/link'

interface ServiceHealth {
  healthy: boolean
  responseTime: number
  error?: string
  details?: Record<string, any>
}

interface HealthStatus {
  status: string
  timestamp: string
  responseTime: number
  services: Record<string, ServiceHealth>
  version: string
  environment: string
}

const serviceIcons = {
  database: Database,
  qloo: Zap,
  gemini: Brain,
  redis: Server,
  default: Activity
}

const serviceNames = {
  database: 'Database',
  qloo: 'Qloo Service',
  gemini: 'Gemini AI',
  redis: 'Redis Cache'
}

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchHealthData = async () => {
    try {
      setError(null)
      const response = await fetch('/api/health')
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }
      
      const data = await response.json()
      setHealthData(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400'
      case 'degraded': return 'text-yellow-400'
      case 'unhealthy': return 'text-red-400'
      default: return 'text-slate-400'
    }
  }

  const getStatusIcon = (healthy: boolean) => {
    return healthy ? CheckCircle : XCircle
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-900/30 border-green-500/30'
      case 'degraded': return 'bg-yellow-900/30 border-yellow-500/30'
      case 'unhealthy': return 'bg-red-900/30 border-red-500/30'
      default: return 'bg-slate-900/30 border-slate-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <Activity className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Loading System Health</h2>
            <p className="text-slate-300">Checking all services...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-slate-100">System Health</h1>
            </div>
            <Link 
              href="/dashboard" 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
            <button 
              onClick={fetchHealthData}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="font-medium text-red-300">Error</span>
            </div>
            <p className="text-red-200 mt-1">{error}</p>
          </div>
        )}

        {healthData && (
          <>
            {/* Overall Status */}
            <div className={`mb-8 p-6 rounded-2xl border ${getStatusBgColor(healthData.status)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${healthData.status === 'healthy' ? 'bg-green-500/20' : 
                    healthData.status === 'degraded' ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                    {healthData.status === 'healthy' ? (
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    ) : healthData.status === 'degraded' ? (
                      <AlertTriangle className="w-8 h-8 text-yellow-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100 capitalize">
                      System {healthData.status}
                    </h2>
                    <p className="text-slate-300">
                      Overall response time: {healthData.responseTime}ms
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-300 text-sm">Version</div>
                  <div className="text-slate-100 font-mono">{healthData.version}</div>
                  <div className="text-slate-300 text-sm mt-1">Environment</div>
                  <div className="text-slate-100 font-mono">{healthData.environment}</div>
                </div>
              </div>
            </div>

            {/* Services Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(healthData.services).map(([serviceName, service]) => {
                const IconComponent = serviceIcons[serviceName as keyof typeof serviceIcons] || serviceIcons.default
                const StatusIcon = getStatusIcon(service.healthy)
                
                return (
                  <div 
                    key={serviceName}
                    className={`p-6 rounded-xl border ${service.healthy ? 
                      'bg-green-900/20 border-green-500/30' : 
                      'bg-red-900/20 border-red-500/30'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-6 h-6 text-blue-400" />
                        <h3 className="text-lg font-semibold text-slate-100">
                          {serviceNames[serviceName as keyof typeof serviceNames] || serviceName}
                        </h3>
                      </div>
                      <StatusIcon className={`w-6 h-6 ${service.healthy ? 'text-green-400' : 'text-red-400'}`} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Status:</span>
                        <span className={service.healthy ? 'text-green-400' : 'text-red-400'}>
                          {service.healthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Response Time:</span>
                        <span className="text-slate-100">{service.responseTime}ms</span>
                      </div>
                      
                      {service.error && (
                        <div className="mt-3 p-3 bg-red-900/30 border border-red-500/30 rounded">
                          <div className="text-sm text-red-300 font-medium mb-1">Error:</div>
                          <div className="text-sm text-red-200">{service.error}</div>
                        </div>
                      )}
                      
                      {service.details && Object.keys(service.details).length > 0 && (
                        <div className="mt-3 p-3 bg-slate-800/50 border border-slate-600/30 rounded">
                          <div className="text-sm text-slate-300 font-medium mb-2">Details:</div>
                          <div className="space-y-1">
                            {Object.entries(service.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-xs">
                                <span className="text-slate-400">{key}:</span>
                                <span className="text-slate-200">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* System Information */}
            <div className="mt-8 p-6 bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">System Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-300">Timestamp:</span>
                  <div className="text-slate-100 font-mono">
                    {new Date(healthData.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-300">Services Checked:</span>
                  <div className="text-slate-100">
                    {Object.keys(healthData.services).length}
                  </div>
                </div>
                <div>
                  <span className="text-slate-300">Healthy Services:</span>
                  <div className="text-slate-100">
                    {Object.values(healthData.services).filter(s => s.healthy).length} / {Object.keys(healthData.services).length}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
