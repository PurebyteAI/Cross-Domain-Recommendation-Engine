'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Brain, Dna, Heart, Sparkles, ArrowLeft, TrendingUp, Eye, Activity, Zap } from 'lucide-react'
import Link from 'next/link'

export default function DiscoverPage() {
  const { user } = useUser()
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/dashboard"
            className="p-2 rounded-lg bg-slate-800/60 backdrop-blur-md border border-blue-500/30 hover:bg-slate-700/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Discover
              </h1>
              <p className="text-slate-300">Explore advanced AI-powered features</p>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-8 border border-blue-500/30 shadow-lg mb-8">
          <div className="text-center">
            <Brain className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-100 mb-3">
              Welcome to the Future of Recommendations
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Experience cutting-edge AI features that revolutionize how you discover content. 
              Our advanced algorithms analyze your preferences at a deeper level than ever before.
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Taste DNA Analysis */}
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-8 border border-pink-500/30 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-600/10 to-purple-700/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-600 to-purple-700 rounded-xl flex items-center justify-center">
                  <Dna className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-100">Taste DNA Analysis</h3>
                  <p className="text-pink-400 font-medium">AI-powered deep preference profiling</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-pink-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Visual Patterns:</span> Analyzes color preferences, aesthetic choices, and visual taste patterns
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Emotional Intelligence:</span> Understands emotional responses to different content types
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-pink-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Cognitive Mapping:</span> Maps thinking patterns and decision-making preferences
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Cultural Context:</span> Identifies cultural influences on taste preferences
                  </p>
                </div>
              </div>

              <Link
                href="/taste-dna"
                className="w-full bg-gradient-to-r from-pink-600 to-purple-700 hover:from-pink-700 hover:to-purple-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group/btn"
              >
                <Dna className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                Generate My Taste DNA
              </Link>
            </div>
          </div>

          {/* Mood-Based AI Recommendations */}
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-8 border border-red-500/30 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-orange-700/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-700 rounded-xl flex items-center justify-center">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-100">Mood-Based AI</h3>
                  <p className="text-red-400 font-medium">Real-time biometric analysis</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Biometric Integration:</span> Camera and microphone analysis for mood detection
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Environmental Context:</span> Weather, time, location-aware recommendations
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Real-time Processing:</span> Instant mood analysis and recommendation updates
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">Contextual Awareness:</span> Activity-based preference adjustments
                  </p>
                </div>
              </div>

              <Link
                href="/mood-recommendations"
                className="w-full bg-gradient-to-r from-red-600 to-orange-700 hover:from-red-700 hover:to-orange-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group/btn"
              >
                <Heart className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                Start Mood Analysis
              </Link>
            </div>
          </div>
        </div>

        {/* Innovation Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-blue-500/30 text-center">
            <Activity className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-slate-100 mb-1">97%</div>
            <div className="text-slate-300 text-sm">Accuracy Rate</div>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-green-500/30 text-center">
            <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-slate-100 mb-1">15x</div>
            <div className="text-slate-300 text-sm">Better Matching</div>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-purple-500/30 text-center">
            <Brain className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-slate-100 mb-1">50+</div>
            <div className="text-slate-300 text-sm">Data Points</div>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-cyan-500/30 text-center">
            <Zap className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-slate-100 mb-1">Real-time</div>
            <div className="text-slate-300 text-sm">Processing</div>
          </div>
        </div>

        {/* Revolutionary AI Features Access */}
        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 backdrop-blur-md rounded-2xl p-8 border border-yellow-500/30 shadow-lg mb-8">
          <div className="text-center mb-8">
            <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-100 mb-3 flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              Revolutionary AI Features
            </h3>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Access cutting-edge experimental features that push the boundaries of AI-powered recommendations. 
              These features represent the future of personalized content discovery.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Neural Pattern Recognition */}
            <div className="group p-6 border-2 border-dashed border-purple-500/50 hover:border-purple-400 rounded-xl transition-all duration-300 hover:bg-purple-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-700/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 text-center">
                <div className="text-purple-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                  <Brain className="w-10 h-10 mx-auto" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-purple-300">
                  🧠 Neural Pattern Recognition
                </h3>
                <p className="text-sm text-slate-300 mb-4">
                  Advanced neural networks that learn from your micro-interactions and subconscious preferences
                </p>
                <button 
                  onClick={() => setSelectedFeature('neural')}
                  className="text-purple-400 font-medium hover:text-purple-300 transition-colors"
                >
                  Coming Soon
                </button>
              </div>
            </div>

            {/* Quantum Recommendation Engine */}
            <div className="group p-6 border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 rounded-xl transition-all duration-300 hover:bg-cyan-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 to-blue-700/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 text-center">
                <div className="text-cyan-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                  <Zap className="w-10 h-10 mx-auto" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-cyan-300">
                  ⚡ Quantum Recommendations
                </h3>
                <p className="text-sm text-slate-300 mb-4">
                  Quantum-inspired algorithms that process infinite possibility spaces for perfect matches
                </p>
                <button 
                  onClick={() => setSelectedFeature('quantum')}
                  className="text-cyan-400 font-medium hover:text-cyan-300 transition-colors"
                >
                  Coming Soon
                </button>
              </div>
            </div>

            {/* Multi-Dimensional Taste Mapping */}
            <div className="group p-6 border-2 border-dashed border-orange-500/50 hover:border-orange-400 rounded-xl transition-all duration-300 hover:bg-orange-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 to-red-700/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 text-center">
                <div className="text-orange-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                  <Activity className="w-10 h-10 mx-auto" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-orange-300">
                  🌐 Multi-Dimensional Mapping
                </h3>
                <p className="text-sm text-slate-300 mb-4">
                  Maps your preferences across infinite dimensional spaces for hyper-personalized results
                </p>
                <button 
                  onClick={() => setSelectedFeature('mapping')}
                  className="text-orange-400 font-medium hover:text-orange-300 transition-colors"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>

          {/* Feature Details Modal */}
          {selectedFeature && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-yellow-500/30 rounded-2xl p-8 max-w-2xl w-full">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-bold text-yellow-400">Revolutionary Feature Preview</h3>
                  <button 
                    onClick={() => setSelectedFeature(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                {selectedFeature === 'neural' && (
                  <div>
                    <h4 className="text-xl font-semibold text-purple-400 mb-4">🧠 Neural Pattern Recognition</h4>
                    <p className="text-slate-300 mb-4">
                      This revolutionary feature uses advanced neural networks to analyze your micro-interactions, 
                      eye movement patterns, scrolling behavior, and even pause durations to understand your 
                      subconscious preferences that you might not even be aware of.
                    </p>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="text-yellow-400 font-medium">🚀 Coming in Q3 2025</p>
                      <p className="text-slate-400 text-sm mt-1">Currently in development with our AI research team</p>
                    </div>
                  </div>
                )}
                {selectedFeature === 'quantum' && (
                  <div>
                    <h4 className="text-xl font-semibold text-cyan-400 mb-4">⚡ Quantum Recommendations</h4>
                    <p className="text-slate-300 mb-4">
                      Utilizing quantum-inspired algorithms that can process infinite possibility spaces 
                      simultaneously, providing recommendations that account for every possible preference 
                      combination in parallel dimensions.
                    </p>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="text-yellow-400 font-medium">🚀 Coming in Q4 2025</p>
                      <p className="text-slate-400 text-sm mt-1">Partnership with quantum computing research labs</p>
                    </div>
                  </div>
                )}
                {selectedFeature === 'mapping' && (
                  <div>
                    <h4 className="text-xl font-semibold text-orange-400 mb-4">🌐 Multi-Dimensional Mapping</h4>
                    <p className="text-slate-300 mb-4">
                      Revolutionary technology that maps your preferences across infinite dimensional spaces, 
                      considering not just what you like, but when, why, how much, and in what context, 
                      creating a complete preference universe unique to you.
                    </p>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="text-yellow-400 font-medium">🚀 Coming in Q2 2026</p>
                      <p className="text-slate-400 text-sm mt-1">Currently in theoretical development phase</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Technology Stack */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-8 border border-blue-500/30 shadow-lg">
          <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-400" />
            Powered by Advanced Technology
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-slate-100 mb-2">Machine Learning</h4>
              <p className="text-slate-300 text-sm">Advanced neural networks for pattern recognition</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-teal-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-slate-100 mb-2">Real-time Analysis</h4>
              <p className="text-slate-300 text-sm">Instant processing and recommendation generation</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-slate-100 mb-2">Computer Vision</h4>
              <p className="text-slate-300 text-sm">Advanced image and facial expression analysis</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
