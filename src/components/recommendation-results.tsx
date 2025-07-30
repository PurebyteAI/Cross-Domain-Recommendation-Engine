'use client'

import { RecommendationResponse, RecommendationsByDomain, Recommendation } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Zap, Star } from 'lucide-react'

interface RecommendationResultsProps {
  response: RecommendationResponse
}

interface RecommendationCardProps {
  recommendation: Recommendation
  domain: string
}

function RecommendationCard({ recommendation, domain }: RecommendationCardProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return '🎬'
      case 'book':
        return '📚'
      case 'song':
        return '🎵'
      case 'artist':
        return '🎤'
      case 'restaurant':
        return '🍽️'
      case 'brand':
        return '🏷️'
      case 'tv_show':
        return '📺'
      case 'podcast':
        return '🎧'
      case 'game':
        return '🎮'
      default:
        return '✨'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400'
    if (confidence >= 0.6) return 'text-yellow-400'
    return 'text-slate-400'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High match'
    if (confidence >= 0.6) return 'Good match'
    return 'Possible match'
  }

  return (
    <Card className="h-full card-hover group relative overflow-hidden bg-slate-800/60 backdrop-blur-md border-blue-500/30">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-indigo-900/30 to-cyan-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-colors">
              <span className="text-xl">{getTypeIcon(recommendation.type)}</span>
            </div>
            <div>
              <CardTitle className="text-lg leading-tight text-slate-100 group-hover:text-blue-300 transition-colors">{recommendation.name}</CardTitle>
              <CardDescription className="capitalize font-medium text-slate-300">{recommendation.type}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm bg-slate-700/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-blue-500/30">
            <Star className={`h-4 w-4 ${getConfidenceColor(recommendation.confidence)}`} />
            <span className={`font-bold ${getConfidenceColor(recommendation.confidence)}`}>
              {Math.round(recommendation.confidence * 100)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 relative z-10">
        {recommendation.explanation && (
          <div className="bg-gradient-to-r from-slate-700/60 to-slate-600/60 rounded-lg p-3 mb-4 border border-blue-500/20">
            <p className="text-sm text-slate-200 leading-relaxed">
              {recommendation.explanation}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Badge 
            variant="secondary" 
            className="text-xs bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-300 border-blue-500/30"
          >
            {getConfidenceLabel(recommendation.confidence)}
          </Badge>
          {recommendation.metadata?.year && typeof recommendation.metadata.year === 'string' ? (
            <span className="text-xs text-slate-400 bg-slate-700/60 px-2 py-1 rounded-full border border-slate-600/50">
              {recommendation.metadata.year}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

interface DomainSectionProps {
  domain: string
  recommendations: Recommendation[]
}

function DomainSection({ domain, recommendations }: DomainSectionProps) {
  const getDomainLabel = (domain: string) => {
    const labels: Record<string, string> = {
      movie: 'Movies',
      book: 'Books',
      song: 'Songs',
      artist: 'Artists',
      restaurant: 'Restaurants',
      brand: 'Brands',
      tv_show: 'TV Shows',
      podcast: 'Podcasts',
      game: 'Games'
    }
    return labels[domain] || domain.charAt(0).toUpperCase() + domain.slice(1)
  }

  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case 'movie':
        return '🎬'
      case 'book':
        return '📚'
      case 'song':
        return '🎵'
      case 'artist':
        return '🎤'
      case 'restaurant':
        return '🍽️'
      case 'brand':
        return '🏷️'
      case 'tv_show':
        return '📺'
      case 'podcast':
        return '🎧'
      case 'game':
        return '🎮'
      default:
        return '✨'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-800/60 to-blue-900/60 rounded-xl border border-blue-500/30">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30">
          <span className="text-2xl">{getDomainIcon(domain)}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {getDomainLabel(domain)}
          </h3>
          <Badge variant="outline" className="mt-1 bg-slate-700/80 text-slate-200 border-blue-500/30">
            {recommendations.length} {recommendations.length === 1 ? 'recommendation' : 'recommendations'}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendations.map((recommendation, index) => (
          <RecommendationCard
            key={`${domain}-${recommendation.id}-${index}`}
            recommendation={recommendation}
            domain={domain}
          />
        ))}
      </div>
    </div>
  )
}

export function RecommendationResults({ response }: RecommendationResultsProps) {
  const totalRecommendations = Object.values(response.recommendations)
    .reduce((total, recs) => total + recs.length, 0)

  const domainCount = Object.keys(response.recommendations).length

  if (totalRecommendations === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto overflow-hidden bg-slate-800/60 backdrop-blur-md border-blue-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-700/50" />
        <CardContent className="p-12 text-center relative z-10">
          <div className="text-8xl mb-6 animate-pulse">🤔</div>
          <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-200 to-slate-100 bg-clip-text text-transparent">
            No recommendations found
          </h3>
          <p className="text-slate-300 text-lg leading-relaxed max-w-md mx-auto">
            We couldn&apos;t find any cross-domain recommendations for your input.
            Try different entities or check if the names are spelled correctly.
          </p>
          <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
            <p className="text-sm text-blue-300">
              💡 Tip: Make sure to use specific, well-known names for better results
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full space-y-8">
      {/* Summary Header */}
      <Card className="relative overflow-hidden bg-slate-800/60 backdrop-blur-md border-blue-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 via-blue-900/50 to-indigo-900/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10" />
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30">
              <Zap className="h-6 w-6 text-blue-400" />
            </div>
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Your Cross-Domain Recommendations
            </span>
          </CardTitle>
          <CardDescription className="text-lg mt-2 text-slate-300">
            Based on your interest in{' '}
            {response.input.map((entity, index) => (
              <span key={index}>
                <strong className="text-blue-400">{entity.name}</strong>
                {index < response.input.length - 1 && (index === response.input.length - 2 ? ' and ' : ', ')}
              </span>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-4 border border-blue-500/30">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold text-blue-400">{totalRecommendations}</p>
                  <p className="text-sm text-slate-300">recommendations</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-4 border border-cyan-500/30">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="text-2xl font-bold text-cyan-400">{domainCount}</p>
                  <p className="text-sm text-slate-300">domains</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-4 border border-indigo-500/30">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-2xl font-bold text-slate-200">{response.processingTime}ms</p>
                  <p className="text-sm text-slate-300">processing time</p>
                </div>
              </div>
            </div>
            {response.cached && (
              <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-4 border border-green-500/30">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-sm font-bold text-green-400">Cached</p>
                    <p className="text-sm text-slate-300">result</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations by Domain */}
      <div className="space-y-8">
        {Object.entries(response.recommendations)
          .sort(([, a], [, b]) => b.length - a.length) // Sort by number of recommendations
          .map(([domain, recommendations]) => (
            <DomainSection
              key={domain}
              domain={domain}
              recommendations={recommendations}
            />
          ))}
      </div>

      {/* Input Summary */}
      <Card className="relative overflow-hidden bg-slate-800/60 backdrop-blur-md border-blue-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-700/50" />
        <CardHeader className="relative z-10">
          <CardTitle className="text-xl flex items-center gap-2 text-slate-100">
            <span className="text-2xl">🎯</span>
            Your Input
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 relative z-10">
          <div className="flex flex-wrap gap-3">
            {response.input.map((entity, index) => (
              <Badge key={index} variant="outline" className="flex items-center gap-2 p-3 text-sm bg-slate-700/80 backdrop-blur-sm border-blue-500/30 hover:border-blue-400/50 transition-colors text-slate-200">
                <span className="text-lg">
                  {entity.type === 'movie' && '🎬'}
                  {entity.type === 'book' && '📚'}
                  {entity.type === 'song' && '🎵'}
                  {entity.type === 'artist' && '🎤'}
                  {entity.type === 'restaurant' && '🍽️'}
                  {entity.type === 'brand' && '🏷️'}
                  {entity.type === 'tv_show' && '📺'}
                  {entity.type === 'podcast' && '🎧'}
                  {entity.type === 'game' && '🎮'}
                </span>
                <div>
                  <span className="font-medium text-slate-100">{entity.name}</span>
                  <span className="text-xs text-slate-400 ml-2">({entity.type})</span>
                </div>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}