'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RecommendationHistoryItem {
  id: string
  input_entity: any
  recommendations: any
  session_id: string
  created_at: string
}

interface HistoryFilters {
  search: string
  domain: string
  dateRange: string
  sortBy: 'newest' | 'oldest' | 'most_relevant'
}

const DOMAIN_ICONS: Record<string, string> = {
  music: '🎵',
  movies: '🎬',
  books: '📚',
  restaurants: '🍽️',
  art: '🎨',
  fashion: '👗',
  travel: '✈️',
  games: '🎮',
  default: '🔍'
}

export function RecommendationHistory() {
  const { user } = useUser()
  const [history, setHistory] = useState<RecommendationHistoryItem[]>([])
  const [filteredHistory, setFilteredHistory] = useState<RecommendationHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<HistoryFilters>({
    search: '',
    domain: 'all',
    dateRange: 'all',
    sortBy: 'newest'
  })
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user) {
      fetchHistory()
    }
  }, [user])

  useEffect(() => {
    applyFilters()
  }, [history, filters])

  const fetchHistory = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/history')
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendation history')
      }
      
      const data = await response.json()
      setHistory(data.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...history]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(item => {
        const inputName = getInputEntityName(item.input_entity).toLowerCase()
        const hasMatchingRec = Object.values(item.recommendations || {}).some((recs: any) =>
          Array.isArray(recs) && recs.some((rec: any) => 
            rec.name?.toLowerCase().includes(searchLower) ||
            rec.explanation?.toLowerCase().includes(searchLower)
          )
        )
        return inputName.includes(searchLower) || hasMatchingRec
      })
    }

    // Domain filter
    if (filters.domain !== 'all') {
      filtered = filtered.filter(item => {
        const recommendations = item.recommendations || {}
        return Object.keys(recommendations).includes(filters.domain)
      })
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1)
          break
      }
      
      filtered = filtered.filter(item => 
        new Date(item.created_at) >= cutoffDate
      )
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      
      switch (filters.sortBy) {
        case 'oldest':
          return dateA - dateB
        case 'newest':
        default:
          return dateB - dateA
      }
    })

    setFilteredHistory(filtered)
  }

  const getInputEntityName = (inputEntity: any): string => {
    if (typeof inputEntity === 'string') return inputEntity
    if (inputEntity?.name) return inputEntity.name
    if (Array.isArray(inputEntity) && inputEntity[0]?.name) return inputEntity[0].name
    return 'Unknown'
  }

  const getInputEntityType = (inputEntity: any): string => {
    if (inputEntity?.type) return inputEntity.type
    if (Array.isArray(inputEntity) && inputEntity[0]?.type) return inputEntity[0].type
    return 'unknown'
  }

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getRecommendationStats = (recommendations: any) => {
    const domains = Object.keys(recommendations || {})
    const totalRecs = domains.reduce((sum, domain) => {
      const recs = recommendations[domain]
      return sum + (Array.isArray(recs) ? recs.length : 0)
    }, 0)
    
    return { domains: domains.length, total: totalRecs }
  }

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear your recommendation history? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/user/history', {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to clear history')
      }
      
      setHistory([])
      setFilteredHistory([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchHistory} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Recommendation History</h2>
          <p className="text-gray-600">
            {filteredHistory.length} of {history.length} recommendations
          </p>
        </div>
        {history.length > 0 && (
          <Button onClick={clearHistory} variant="outline" size="sm">
            Clear History
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                placeholder="Search recommendations..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <Select
              value={filters.domain}
              onValueChange={(value) => setFilters(prev => ({ ...prev, domain: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                <SelectItem value="music">🎵 Music</SelectItem>
                <SelectItem value="movies">🎬 Movies</SelectItem>
                <SelectItem value="books">📚 Books</SelectItem>
                <SelectItem value="restaurants">🍽️ Restaurants</SelectItem>
                <SelectItem value="art">🎨 Art</SelectItem>
                <SelectItem value="fashion">👗 Fashion</SelectItem>
                <SelectItem value="travel">✈️ Travel</SelectItem>
                <SelectItem value="games">🎮 Games</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.dateRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Past week</SelectItem>
                <SelectItem value="month">Past month</SelectItem>
                <SelectItem value="year">Past year</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sortBy}
              onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as any }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* History Items */}
      {filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No recommendations found</h3>
            <p className="text-gray-600 mb-4">
              {history.length === 0 
                ? "You haven't made any recommendations yet. Start exploring to build your history!"
                : "Try adjusting your filters to see more results."
              }
            </p>
            {history.length === 0 && (
              <Button onClick={() => window.location.href = '/'}>
                Get Recommendations
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => {
            const inputName = getInputEntityName(item.input_entity)
            const inputType = getInputEntityType(item.input_entity)
            const stats = getRecommendationStats(item.recommendations)
            const isExpanded = expandedItems.has(item.id)
            
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span>{DOMAIN_ICONS[inputType] || DOMAIN_ICONS.default}</span>
                        {inputName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span>{formatDate(item.created_at)}</span>
                        <span>•</span>
                        <span>{stats.total} recommendations across {stats.domains} domains</span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      {isExpanded ? 'Hide' : 'Show'} Details
                    </Button>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(item.recommendations || {}).map(([domain, recs]) => {
                        if (!Array.isArray(recs) || recs.length === 0) return null
                        
                        return (
                          <div key={domain} className="border-l-4 border-blue-200 pl-4">
                            <h4 className="font-semibold flex items-center gap-2 mb-2">
                              <span>{DOMAIN_ICONS[domain] || DOMAIN_ICONS.default}</span>
                              {domain.charAt(0).toUpperCase() + domain.slice(1)}
                              <Badge variant="secondary">{recs.length}</Badge>
                            </h4>
                            <div className="space-y-2">
                              {recs.slice(0, 3).map((rec: any, index: number) => (
                                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                                  <div className="flex justify-between items-start mb-1">
                                    <h5 className="font-medium">{rec.name}</h5>
                                    {rec.confidence && (
                                      <Badge variant="outline" className="text-xs">
                                        {Math.round(rec.confidence * 100)}% match
                                      </Badge>
                                    )}
                                  </div>
                                  {rec.explanation && (
                                    <p className="text-sm text-gray-600">{rec.explanation}</p>
                                  )}
                                </div>
                              ))}
                              {recs.length > 3 && (
                                <p className="text-sm text-gray-500 text-center">
                                  +{recs.length - 3} more recommendations
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}