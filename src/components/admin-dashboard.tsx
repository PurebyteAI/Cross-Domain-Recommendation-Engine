'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: Array<{
    service: string
    healthy: boolean
    responseTime: number
    error?: string
    details?: Record<string, any>
    timestamp: string
  }>
  timestamp: string
  version: string
  environment: string
}

interface SystemMetric {
  name: string
  value: number
  unit?: string
  tags?: Record<string, any>
  timestamp: string
}

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  service: string
  operation?: string
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  statusCode?: number
  responseTime?: number
  metadata?: Record<string, any>
  error?: {
    code?: string
    message: string
    stack?: string
  }
}

interface Alert {
  timestamp: string
  alertId: string
  severity: string
  message: string
  status: string
}

export function AdminDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch system health
  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/health', {
        method: 'POST' // Use POST for detailed health check
      })
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }
      
      const health = await response.json()
      setSystemHealth(health)
    } catch (err) {
      console.error('Failed to fetch system health:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch system health')
    }
  }

  // Fetch system metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics')
      
      if (!response.ok) {
        throw new Error(`Metrics fetch failed: ${response.status}`)
      }
      
      const data = await response.json()
      setMetrics(data.metrics || [])
    } catch (err) {
      console.error('Failed to fetch metrics:', err)
    }
  }

  // Fetch recent logs
  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/admin/logs?limit=50')
      
      if (!response.ok) {
        throw new Error(`Logs fetch failed: ${response.status}`)
      }
      
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    }
  }

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts')
      
      if (!response.ok) {
        throw new Error(`Alerts fetch failed: ${response.status}`)
      }
      
      const data = await response.json()
      setAlerts(data.alerts || [])
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
    }
  }

  // Trigger test alert
  const triggerTestAlert = async () => {
    try {
      const response = await fetch('/api/admin/alerts/test', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`Test alert failed: ${response.status}`)
      }
      
      // Refresh alerts after triggering test
      setTimeout(fetchAlerts, 1000)
    } catch (err) {
      console.error('Failed to trigger test alert:', err)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([
        fetchSystemHealth(),
        fetchMetrics(),
        fetchLogs(),
        fetchAlerts()
      ])
      setLoading(false)
    }

    fetchData()

    // Set up periodic refresh
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'default'
      case 'degraded': return 'secondary'
      case 'unhealthy': return 'destructive'
      default: return 'outline'
    }
  }

  const getServiceStatusBadge = (healthy: boolean) => {
    return (
      <Badge variant={healthy ? 'default' : 'destructive'}>
        {healthy ? 'Healthy' : 'Unhealthy'}
      </Badge>
    )
  }

  const getLogLevelBadge = (level: string) => {
    const variant = level === 'error' ? 'destructive' : 
                   level === 'warn' ? 'secondary' : 'outline'
    return <Badge variant={variant}>{level.toUpperCase()}</Badge>
  }

  const getSeverityBadge = (severity: string) => {
    const variant = severity === 'critical' ? 'destructive' :
                   severity === 'high' ? 'destructive' :
                   severity === 'medium' ? 'secondary' : 'outline'
    return <Badge variant={variant}>{severity.toUpperCase()}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading dashboard: {error}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={triggerTestAlert} variant="outline">
            Test Alert
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            System Health
            {systemHealth && (
              <Badge variant={getHealthBadgeVariant(systemHealth.overall)}>
                {systemHealth.overall.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Overall system status and service health
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemHealth ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Version</p>
                  <p className="font-semibold">{systemHealth.version}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Environment</p>
                  <p className="font-semibold">{systemHealth.environment}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Services</p>
                  <p className="font-semibold">{systemHealth.services.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Last Check</p>
                  <p className="font-semibold">
                    {new Date(systemHealth.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Service Status</h4>
                {systemHealth.services.map((service) => (
                  <div key={service.service} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-medium capitalize">{service.service}</span>
                      {getServiceStatusBadge(service.healthy)}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {service.responseTime}ms
                      </p>
                      {service.error && (
                        <p className="text-sm text-red-600">{service.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-600">No health data available</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>
            System alerts and notifications from the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.slice(0, 10).map((alert, index) => (
                <div key={`${alert.alertId}-${index}`} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(alert.severity)}
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                    <Badge variant={alert.status === 'resolved' ? 'default' : 'destructive'}>
                      {alert.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No recent alerts</p>
          )}
        </CardContent>
      </Card>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>System Metrics</CardTitle>
          <CardDescription>
            Key performance indicators and system metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.slice(0, 12).map((metric, index) => (
                <div key={`${metric.name}-${index}`} className="p-3 border rounded">
                  <h4 className="font-semibold capitalize">
                    {metric.name.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-2xl font-bold">
                    {metric.value.toLocaleString()}
                    {metric.unit && <span className="text-sm text-gray-600 ml-1">{metric.unit}</span>}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(metric.timestamp).toLocaleString()}
                  </p>
                  {metric.tags && Object.keys(metric.tags).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(metric.tags).slice(0, 3).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No metrics available</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
          <CardDescription>
            System logs and error messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getLogLevelBadge(log.level)}
                      <span className="font-medium">{log.service}</span>
                      {log.operation && (
                        <Badge variant="outline">{log.operation}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {log.endpoint && `${log.method} ${log.endpoint}`}
                      {log.statusCode && ` (${log.statusCode})`}
                      {log.responseTime && ` - ${log.responseTime}ms`}
                    </div>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-800">
                        {log.error.code && `[${log.error.code}] `}
                        {log.error.message}
                      </p>
                    </div>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      <details>
                        <summary className="cursor-pointer">Metadata</summary>
                        <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No recent logs</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}