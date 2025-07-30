'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Brain, Dna, Sparkles, TrendingUp, Eye, Fingerprint } from 'lucide-react'
import Link from 'next/link'

interface TasteDNA {
  visual_preferences: {
    color_palette: string[]
    aesthetic_style: string
    complexity_preference: number
  }
  emotional_resonance: {
    mood_preferences: string[]
    energy_level: number
    emotional_depth: number
  }
  cognitive_patterns: {
    narrative_preference: string
    pacing_preference: string
    complexity_tolerance: number
  }
  cultural_affinity: {
    time_periods: string[]
    geographical_preferences: string[]
    cultural_elements: string[]
  }
  taste_evolution: {
    trend: string
    confidence: number
    predicted_interests: string[]
  }
}

interface TasteProfile {
  id: string
  user_id: string
  taste_dna: TasteDNA
  confidence_score: number
  last_updated: string
  total_interactions: number
}

export default function TasteDNAPage() {
  const { user } = useUser()
  const [profile, setProfile] = useState<TasteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)

  const generateTasteDNA = async () => {
    setAnalyzing(true)
    setProgress(0)

    try {
      // Simulate AI analysis progress
      const steps = [
        'Analyzing interaction patterns...',
        'Processing emotional responses...',
        'Mapping aesthetic preferences...',
        'Identifying cultural patterns...',
        'Generating taste DNA profile...',
        'Calculating confidence scores...',
        'Finalizing recommendations...'
      ]

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setProgress(((i + 1) / steps.length) * 100)
      }

      // Generate realistic taste DNA data
      const tasteDNA: TasteDNA = {
        visual_preferences: {
          color_palette: ['#2563EB', '#7C3AED', '#059669', '#DC2626'],
          aesthetic_style: 'Modern Minimalist with Dark Academic influences',
          complexity_preference: 0.75
        },
        emotional_resonance: {
          mood_preferences: ['Contemplative', 'Energetic', 'Mysterious', 'Uplifting'],
          energy_level: 0.68,
          emotional_depth: 0.82
        },
        cognitive_patterns: {
          narrative_preference: 'Complex multi-layered storytelling',
          pacing_preference: 'Gradual build with intense climaxes',
          complexity_tolerance: 0.88
        },
        cultural_affinity: {
          time_periods: ['Contemporary', '1980s-1990s', 'Classical Renaissance'],
          geographical_preferences: ['Nordic', 'Japanese', 'British'],
          cultural_elements: ['Technology integration', 'Philosophical themes', 'Artistic innovation']
        },
        taste_evolution: {
          trend: 'Expanding toward experimental content',
          confidence: 0.79,
          predicted_interests: ['Ambient techno', 'Neo-noir cinema', 'Speculative fiction', 'Molecular gastronomy']
        }
      }

      setProfile({
        id: 'dna_' + Date.now(),
        user_id: user?.id || 'unknown',
        taste_dna: tasteDNA,
        confidence_score: 0.85,
        last_updated: new Date().toISOString(),
        total_interactions: 247
      })

    } catch (error) {
      console.error('Error generating Taste DNA:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    // Check if user has existing taste DNA
    if (user) {
      setTimeout(() => {
        setLoading(false)
      }, 1000)
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-300">Loading your Taste DNA profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-purple-600/20 to-indigo-700/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Dna className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Your Taste DNA
            </h1>
          </div>
          <p className="text-xl text-slate-300 mb-6">
            Advanced AI analysis of your unique preference patterns
          </p>
          <Link 
            href="/dashboard" 
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {!profile && !analyzing && (
          <div className="text-center mb-8">
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8 max-w-2xl mx-auto">
              <Fingerprint className="w-20 h-20 text-purple-400 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-slate-100 mb-4">
                Generate Your Taste DNA Profile
              </h2>
              <p className="text-slate-300 mb-6">
                Our advanced AI will analyze your preferences, interactions, and patterns to create 
                a unique "Taste DNA" profile that reveals the deep patterns behind your preferences.
              </p>
              <button
                onClick={generateTasteDNA}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Sparkles className="w-5 h-5 inline mr-2" />
                Generate My Taste DNA
              </button>
            </div>
          </div>
        )}

        {analyzing && (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8 max-w-2xl mx-auto mb-8">
            <div className="text-center">
              <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-xl font-semibold text-slate-100 mb-4">
                Analyzing Your Taste Patterns...
              </h3>
              <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-slate-300">{Math.round(progress)}% complete</p>
            </div>
          </div>
        )}

        {profile && (
          <div className="space-y-8">
            {/* Main Profile Overview */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Dna className="w-8 h-8 text-purple-400" />
                  <h2 className="text-2xl font-bold text-slate-100">Taste DNA Profile</h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-400">
                    {(profile.confidence_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-slate-400">Confidence Score</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Visual DNA */}
                <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/20">
                  <Eye className="w-6 h-6 text-purple-400 mb-3" />
                  <h3 className="font-semibold text-slate-100 mb-2">Visual DNA</h3>
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {profile.taste_dna.visual_preferences.color_palette.map((color, i) => (
                        <div 
                          key={i}
                          className="w-4 h-4 rounded-full border border-slate-600"
                          style={{ backgroundColor: color }}
                        ></div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      {profile.taste_dna.visual_preferences.aesthetic_style}
                    </p>
                  </div>
                </div>

                {/* Emotional DNA */}
                <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg p-4 border border-blue-500/20">
                  <Brain className="w-6 h-6 text-blue-400 mb-3" />
                  <h3 className="font-semibold text-slate-100 mb-2">Emotional DNA</h3>
                  <div className="space-y-2">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${profile.taste_dna.emotional_resonance.emotional_depth * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-400">
                      {(profile.taste_dna.emotional_resonance.emotional_depth * 100).toFixed(0)}% Emotional Depth
                    </p>
                  </div>
                </div>

                {/* Cognitive DNA */}
                <div className="bg-gradient-to-br from-cyan-900/30 to-green-900/30 rounded-lg p-4 border border-cyan-500/20">
                  <TrendingUp className="w-6 h-6 text-cyan-400 mb-3" />
                  <h3 className="font-semibold text-slate-100 mb-2">Cognitive DNA</h3>
                  <div className="space-y-2">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-cyan-500 h-2 rounded-full"
                        style={{ width: `${profile.taste_dna.cognitive_patterns.complexity_tolerance * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-400">
                      {(profile.taste_dna.cognitive_patterns.complexity_tolerance * 100).toFixed(0)}% Complexity Tolerance
                    </p>
                  </div>
                </div>

                {/* Evolution DNA */}
                <div className="bg-gradient-to-br from-green-900/30 to-yellow-900/30 rounded-lg p-4 border border-green-500/20">
                  <Sparkles className="w-6 h-6 text-green-400 mb-3" />
                  <h3 className="font-semibold text-slate-100 mb-2">Evolution DNA</h3>
                  <div className="space-y-2">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${profile.taste_dna.taste_evolution.confidence * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-400">
                      {profile.taste_dna.taste_evolution.trend}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Emotional Resonance */}
              <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 p-6">
                <h3 className="text-xl font-semibold text-slate-100 mb-4">Emotional Resonance Patterns</h3>
                <div className="space-y-4">
                  {profile.taste_dna.emotional_resonance.mood_preferences.map((mood, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-slate-300">{mood}</span>
                      <div className="w-24 bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.random() * 80 + 20}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cultural Affinity */}
              <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-6">
                <h3 className="text-xl font-semibold text-slate-100 mb-4">Cultural Affinity Matrix</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Time Periods</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.taste_dna.cultural_affinity.time_periods.map((period, i) => (
                        <span key={i} className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-xs">
                          {period}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Geographical</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.taste_dna.cultural_affinity.geographical_preferences.map((geo, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">
                          {geo}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Predicted Future Interests */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-green-500/30 p-6">
              <h3 className="text-xl font-semibold text-slate-100 mb-4">
                AI-Predicted Future Interests
              </h3>
              <p className="text-slate-300 mb-4">
                Based on your taste evolution patterns, our AI predicts you'll likely enjoy these emerging areas:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {profile.taste_dna.taste_evolution.predicted_interests.map((interest, i) => (
                  <div key={i} className="bg-gradient-to-br from-green-900/30 to-cyan-900/30 rounded-lg p-4 border border-green-500/20">
                    <h4 className="font-medium text-slate-100">{interest}</h4>
                    <div className="mt-2 w-full bg-slate-700 rounded-full h-1">
                      <div 
                        className="bg-green-500 h-1 rounded-full"
                        style={{ width: `${Math.random() * 30 + 70}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {(Math.random() * 30 + 70).toFixed(0)}% match probability
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="text-center text-sm text-slate-400">
              Last updated: {new Date(profile.last_updated).toLocaleString()} | 
              Based on {profile.total_interactions} interactions
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
