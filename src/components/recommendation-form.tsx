'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Loader2, Sparkles, Film, Book, Music, MapPin, Tv, Mic, Building } from 'lucide-react'
import { Entity, EntityType, RecommendationRequest } from '@/types'

interface RecommendationFormProps {
  onSubmit: (request: RecommendationRequest) => Promise<void>
  loading?: boolean
}

const ENTITY_TYPES: { value: EntityType; label: string; icon: React.ReactNode }[] = [
  { value: 'movie', label: 'Movie', icon: <Film className="w-4 h-4" /> },
  { value: 'book', label: 'Book', icon: <Book className="w-4 h-4" /> },
  { value: 'song', label: 'Song', icon: <Music className="w-4 h-4" /> },
  { value: 'artist', label: 'Artist', icon: <Mic className="w-4 h-4" /> },
  { value: 'restaurant', label: 'Restaurant', icon: <MapPin className="w-4 h-4" /> },
  { value: 'brand', label: 'Brand', icon: <Building className="w-4 h-4" /> },
  { value: 'tv_show', label: 'TV Show', icon: <Tv className="w-4 h-4" /> },
  { value: 'podcast', label: 'Podcast', icon: <Mic className="w-4 h-4" /> }
]

const DOMAIN_OPTIONS = [
  { value: 'movie', label: 'Movies', icon: <Film className="w-4 h-4" /> },
  { value: 'book', label: 'Books', icon: <Book className="w-4 h-4" /> },
  { value: 'song', label: 'Songs', icon: <Music className="w-4 h-4" /> },
  { value: 'artist', label: 'Artists', icon: <Mic className="w-4 h-4" /> },
  { value: 'restaurant', label: 'Restaurants', icon: <MapPin className="w-4 h-4" /> },
  { value: 'brand', label: 'Brands', icon: <Building className="w-4 h-4" /> },
  { value: 'tv_show', label: 'TV Shows', icon: <Tv className="w-4 h-4" /> },
  { value: 'podcast', label: 'Podcasts', icon: <Mic className="w-4 h-4" /> }
]

export function RecommendationForm({ onSubmit, loading = false }: RecommendationFormProps) {
  const [entities, setEntities] = useState<Entity[]>([
    { name: '', type: 'movie' }
  ])
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [limit, setLimit] = useState(5)
  const [includeExplanations, setIncludeExplanations] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const addEntity = () => {
    if (entities.length < 5) {
      setEntities([...entities, { name: '', type: 'movie' }])
    }
  }

  const removeEntity = (index: number) => {
    if (entities.length > 1) {
      setEntities(entities.filter((_, i) => i !== index))
    }
  }

  const updateEntity = (index: number, field: keyof Entity, value: string) => {
    const updated = [...entities]
    updated[index] = { ...updated[index], [field]: value }
    setEntities(updated)
    
    // Clear error for this field
    const errorKey = `entity-${index}-${field}`
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[errorKey]
        return newErrors
      })
    }
  }

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => 
      prev.includes(domain) 
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    )
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate entities
    entities.forEach((entity, index) => {
      if (!entity.name.trim()) {
        newErrors[`entity-${index}-name`] = 'Entity name is required'
      }
    })

    // Validate limit
    if (limit < 1 || limit > 20) {
      newErrors.limit = 'Limit must be between 1 and 20'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    const request: RecommendationRequest = {
      entities: entities.filter(entity => entity.name.trim()),
      domains: selectedDomains.length > 0 ? selectedDomains : undefined,
      limit,
      includeExplanations
    }

    try {
      await onSubmit(request)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="bg-slate-900/90 backdrop-blur-md border border-blue-500/30 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold">
            Discover Your Taste
          </CardTitle>
          <CardDescription className="text-slate-300 text-base mt-2">
            Enter your favorite movies, books, songs, or other items to discover surprising connections across different domains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Entities Section */}
            <div className="space-y-6">
              <div className="text-center">
                <Label className="text-lg font-semibold text-slate-100">What do you love? (1-5 items)</Label>
                <p className="text-sm text-slate-400 mt-1">Share your favorites and we'll find amazing connections</p>
              </div>
              
              <div className="space-y-4">
                {entities.map((entity, index) => (
                  <div key={index} className="group bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
                    <div className="flex gap-3 items-start">
                      <div className="flex-1 space-y-3">
                        <Input
                          placeholder="e.g., Inception, Radiohead, The Great Gatsby..."
                          value={entity.name}
                          onChange={(e) => updateEntity(index, 'name', e.target.value)}
                          className={`bg-slate-700/80 border-slate-600 focus:border-blue-400 focus:ring-blue-400/20 text-slate-100 placeholder:text-slate-400 ${errors[`entity-${index}-name`] ? 'border-red-400 focus:border-red-400' : ''}`}
                        />
                        {errors[`entity-${index}-name`] && (
                          <p className="text-red-400 text-sm">{errors[`entity-${index}-name`]}</p>
                        )}
                        
                        <Select value={entity.type} onValueChange={(value) => updateEntity(index, 'type', value)}>
                          <SelectTrigger className="bg-slate-700/80 border-slate-600 focus:border-blue-400 focus:ring-blue-400/20 text-slate-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800/95 backdrop-blur-md border border-blue-500/40 text-slate-100">
                            {ENTITY_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value} className="focus:bg-blue-900/50 text-slate-100">
                                <div className="flex items-center gap-2">
                                  {type.icon}
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {entities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntity(index)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors group-hover:opacity-100 opacity-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {entities.length < 5 && (
                <button
                  type="button"
                  onClick={addEntity}
                  className="w-full p-4 border-2 border-dashed border-blue-500/40 hover:border-blue-400 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add another favorite (optional)
                </button>
              )}
            </div>

            {/* Domain Filter Section */}
            <div className="space-y-4">
              <div className="text-center">
                <Label className="text-lg font-semibold text-slate-100">Where should we look?</Label>
                <p className="text-sm text-slate-400 mt-1">Leave empty to search all domains, or select specific ones</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {DOMAIN_OPTIONS.map((domain) => (
                  <label
                    key={domain.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                      selectedDomains.includes(domain.value)
                        ? 'border-blue-400 bg-blue-900/50 text-blue-300'
                        : 'border-slate-600 bg-slate-800/60 hover:border-blue-500 hover:bg-blue-900/30 text-slate-300'
                    }`}
                  >
                    <Checkbox
                      checked={selectedDomains.includes(domain.value)}
                      onCheckedChange={() => toggleDomain(domain.value)}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <div className="flex items-center gap-2">
                      {domain.icon}
                      <span className="text-sm font-medium">{domain.label}</span>
                    </div>
                  </label>
                ))}
              </div>

              {selectedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDomains.map((domain) => {
                    const domainOption = DOMAIN_OPTIONS.find(d => d.value === domain)
                    return (
                      <Badge
                        key={domain}
                        variant="secondary"
                        className="bg-blue-900/60 text-blue-300 hover:bg-blue-800/60 cursor-pointer border border-blue-500/30"
                        onClick={() => toggleDomain(domain)}
                      >
                        {domainOption?.icon}
                        <span className="ml-1">{domainOption?.label}</span>
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Settings Section */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30 space-y-4">
              <Label className="text-base font-semibold text-slate-100">Settings</Label>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limit" className="text-sm font-medium text-slate-300">
                    Recommendations per domain
                  </Label>
                  <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                    <SelectTrigger className="bg-slate-700/80 border-slate-600 focus:border-blue-400 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 backdrop-blur-md text-slate-100">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map((num) => (
                        <SelectItem key={num} value={num.toString()} className="focus:bg-blue-900/50">
                          {num} recommendation{num !== 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.limit && (
                    <p className="text-red-400 text-sm">{errors.limit}</p>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="explanations"
                    checked={includeExplanations}
                    onCheckedChange={(checked) => setIncludeExplanations(checked as boolean)}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="explanations" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Include AI explanations
                  </Label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Discovering connections...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Discover My Taste
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}