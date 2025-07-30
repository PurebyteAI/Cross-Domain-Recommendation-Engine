'use client'

import { useState, useEffect } from 'react'
import { Camera, Mic, Heart, Brain, Zap, Moon, Sun, CloudRain, Coffee } from 'lucide-react'
import Link from 'next/link'

interface MoodAnalysis {
  primary_emotion: string
  emotional_intensity: number
  energy_level: number
  stress_indicators: string[]
  detected_context: {
    time_of_day: string
    weather_mood: string
    social_context: string
  }
  recommended_domains: {
    domain: string
    reasoning: string
    confidence: number
  }[]
}

interface BiometricData {
  heart_rate?: number
  voice_tone?: string
  facial_expression?: string
  time_of_day: string
  location_context?: string
}

export default function MoodBasedRecommendations() {
  const [moodAnalysis, setMoodAnalysis] = useState<MoodAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [permissions, setPermissions] = useState({
    camera: false,
    microphone: false,
    location: false
  })

  const analyzeMood = async () => {
    setAnalyzing(true)
    
    try {
      // Simulate advanced mood analysis
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const analysis: MoodAnalysis = {
        primary_emotion: 'Contemplative with Creative Energy',
        emotional_intensity: 0.72,
        energy_level: 0.68,
        stress_indicators: ['Slight tension in voice', 'Focused micro-expressions'],
        detected_context: {
          time_of_day: 'Late Evening',
          weather_mood: 'Cozy Rainy Night',
          social_context: 'Alone time / Deep work'
        },
        recommended_domains: [
          {
            domain: 'Ambient Music',
            reasoning: 'Your current contemplative state pairs well with atmospheric soundscapes',
            confidence: 0.89
          },
          {
            domain: 'Philosophical Books',
            reasoning: 'Detected high cognitive engagement and introspective mood',
            confidence: 0.84
          },
          {
            domain: 'Art House Cinema',
            reasoning: 'Evening contemplation suggests openness to complex narratives',
            confidence: 0.78
          },
          {
            domain: 'Tea & Warm Beverages',
            reasoning: 'Rainy weather and introspective mood indicate comfort-seeking behavior',
            confidence: 0.92
          }
        ]
      }
      
      setMoodAnalysis(analysis)
    } catch (error) {
      console.error('Mood analysis error:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const requestPermissions = async () => {
    try {
      // Request camera permission
      if (navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setPermissions(prev => ({ ...prev, camera: true, microphone: true }))
        stream.getTracks().forEach(track => track.stop()) // Stop immediately after getting permission
      }
      
      // Request location permission
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(() => {
          setPermissions(prev => ({ ...prev, location: true }))
        })
      }
    } catch (error) {
      console.log('Permission denied or not available')
    }
  }

  const getMoodIcon = (emotion: string) => {
    if (emotion.includes('Creative')) return <Zap className="w-6 h-6 text-yellow-400" />
    if (emotion.includes('Contemplative')) return <Brain className="w-6 h-6 text-purple-400" />
    if (emotion.includes('Energetic')) return <Sun className="w-6 h-6 text-orange-400" />
    if (emotion.includes('Calm')) return <Moon className="w-6 h-6 text-blue-400" />
    return <Heart className="w-6 h-6 text-red-400" />
  }

  const getContextIcon = (context: string) => {
    if (context.includes('Rainy')) return <CloudRain className="w-5 h-5 text-blue-400" />
    if (context.includes('Evening')) return <Moon className="w-5 h-5 text-indigo-400" />
    if (context.includes('work')) return <Coffee className="w-5 h-5 text-amber-400" />
    return <Sun className="w-5 h-5 text-yellow-400" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-gradient-to-br from-purple-600/20 to-pink-700/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-10 h-10 text-pink-400 animate-pulse" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Mood-Based AI Recommendations
            </h1>
          </div>
          <p className="text-xl text-slate-300 mb-6">
            Real-time biometric analysis for personalized recommendations
          </p>
          <Link 
            href="/dashboard" 
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {!permissions.camera && !analyzing && !moodAnalysis && (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8 max-w-2xl mx-auto mb-8">
            <div className="text-center">
              <div className="flex justify-center gap-4 mb-6">
                <Camera className="w-12 h-12 text-purple-400" />
                <Mic className="w-12 h-12 text-blue-400" />
                <Heart className="w-12 h-12 text-pink-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4">
                Enable Advanced Mood Analysis
              </h2>
              <p className="text-slate-300 mb-6">
                Allow camera, microphone, and location access for real-time mood detection and 
                personalized recommendations based on your current emotional state and context.
              </p>
              <div className="space-y-3 mb-6 text-left">
                <div className="flex items-center gap-3 text-slate-300">
                  <Camera className="w-5 h-5 text-purple-400" />
                  <span>Facial expression analysis for emotional state</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Mic className="w-5 h-5 text-blue-400" />
                  <span>Voice tone analysis for stress and energy levels</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Heart className="w-5 h-5 text-pink-400" />
                  <span>Context awareness for time and location</span>
                </div>
              </div>
              <button
                onClick={requestPermissions}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Enable Mood Analysis
              </button>
            </div>
          </div>
        )}

        {permissions.camera && !analyzing && !moodAnalysis && (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-green-500/30 p-8 max-w-2xl mx-auto mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-4">
                Ready for Mood Analysis
              </h3>
              <p className="text-slate-300 mb-6">
                Click below to start real-time analysis of your current mood and receive 
                personalized recommendations tailored to your emotional state.
              </p>
              <button
                onClick={analyzeMood}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Brain className="w-5 h-5 inline mr-2" />
                Analyze My Current Mood
              </button>
            </div>
          </div>
        )}

        {analyzing && (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8 max-w-2xl mx-auto mb-8">
            <div className="text-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200/20 border-t-purple-400 rounded-full animate-spin mx-auto mb-6"></div>
                <Heart className="w-8 h-8 text-pink-400 absolute top-6 left-1/2 transform -translate-x-1/2 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">
                Analyzing Your Current Mood...
              </h3>
              <p className="text-slate-300 mb-4">
                Processing facial expressions, voice patterns, and contextual data
              </p>
              <div className="flex justify-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {moodAnalysis && (
          <div className="space-y-8">
            {/* Main Mood Analysis */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8">
              <div className="flex items-center gap-4 mb-6">
                {getMoodIcon(moodAnalysis.primary_emotion)}
                <div>
                  <h2 className="text-2xl font-bold text-slate-100">Current Mood Analysis</h2>
                  <p className="text-purple-300 text-lg">{moodAnalysis.primary_emotion}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-4 border border-purple-500/20">
                  <h3 className="font-semibold text-slate-100 mb-2">Emotional Intensity</h3>
                  <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full"
                      style={{ width: `${moodAnalysis.emotional_intensity * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-slate-400">
                    {(moodAnalysis.emotional_intensity * 100).toFixed(0)}% intensity
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg p-4 border border-blue-500/20">
                  <h3 className="font-semibold text-slate-100 mb-2">Energy Level</h3>
                  <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full"
                      style={{ width: `${moodAnalysis.energy_level * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-slate-400">
                    {(moodAnalysis.energy_level * 100).toFixed(0)}% energy
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg p-4 border border-green-500/20">
                  <h3 className="font-semibold text-slate-100 mb-2">Context Detected</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      {getContextIcon(moodAnalysis.detected_context.time_of_day)}
                      <span>{moodAnalysis.detected_context.time_of_day}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      {getContextIcon(moodAnalysis.detected_context.weather_mood)}
                      <span>{moodAnalysis.detected_context.weather_mood}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stress Indicators */}
              <div className="mb-6">
                <h3 className="font-semibold text-slate-100 mb-3">Detected Patterns</h3>
                <div className="flex flex-wrap gap-2">
                  {moodAnalysis.stress_indicators.map((indicator, i) => (
                    <span key={i} className="px-3 py-1 bg-orange-900/30 text-orange-300 rounded-full text-sm border border-orange-500/20">
                      {indicator}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Mood-Based Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {moodAnalysis.recommended_domains.map((rec, i) => (
                <div key={i} className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-blue-500/30 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-slate-100">{rec.domain}</h3>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-400">
                        {(rec.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-400">match</div>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm mb-4">{rec.reasoning}</p>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                      style={{ width: `${rec.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="text-center space-x-4">
              <button
                onClick={analyzeMood}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
              >
                Re-analyze Mood
              </button>
              <Link
                href="/recommendations?mood=true"
                className="bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-700 hover:to-cyan-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 inline-block"
              >
                Get Mood-Based Recommendations
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
