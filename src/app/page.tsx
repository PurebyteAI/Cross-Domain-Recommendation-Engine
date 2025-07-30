'use client'

import { useState, useEffect } from 'react'
import { SignInButton, SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import { RecommendationForm } from '@/components/recommendation-form'
import { RecommendationResults } from '@/components/recommendation-results'
import { AlertCircle, Sparkles, ArrowRight, Star, CheckCircle, Brain, Globe, Palette } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { RecommendationRequest, RecommendationResponse, ErrorResponse } from '@/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Home() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<RecommendationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // No redirect logic - users stay on discover page after login

  const handleSubmit = async (request: RecommendationRequest) => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/v1/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorData = data as ErrorResponse
        throw new Error(errorData.error.message || 'Failed to get recommendations')
      }

      setResponse(data as RecommendationResponse)
    } catch (err) {
      console.error('Error getting recommendations:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking authentication
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-600/20 to-indigo-700/20 rounded-full blur-3xl float-animation"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl float-animation float-delay-1"></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full blur-3xl float-animation float-delay-2"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-6">
          <nav className="flex justify-between items-center backdrop-blur-md bg-slate-800/40 rounded-full px-6 py-3 border border-blue-500/30 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                TasteSync
              </span>
            </div>
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-8 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl button-glow font-semibold">
                    Get Started
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link 
                  href="/dashboard"
                  className="text-slate-400 hover:text-blue-400 transition-colors px-3 py-2 rounded-lg hover:bg-blue-900/20 font-medium text-sm"
                >
                  Dashboard
                </Link>
                <UserButton />
              </SignedIn>
            </div>
          </nav>
        </header>

        <SignedOut>
          {/* Landing Page for Non-Authenticated Users */}
          <section className="container mx-auto px-4 py-16 text-center">
            <div className="max-w-6xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 px-4 py-2 rounded-full text-blue-300 text-sm font-medium mb-8 border border-blue-500/30">
                <Star className="w-4 h-4" />
                AI-Powered Cross-Domain Recommendations
              </div>
              
              <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-8 leading-tight">
                Discover Your Perfect
                <br />
                <span className="gradient-text-animated">
                  Taste Universe
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-4xl mx-auto leading-relaxed">
                From movies you love to books you'll adore. From artists you follow to restaurants you'll crave. 
                <br />
                <strong className="text-blue-400">Experience the magic of cross-domain taste discovery.</strong>
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
                <SignInButton mode="modal">
                  <button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-12 py-4 rounded-full transition-all duration-300 shadow-xl hover:shadow-2xl button-glow font-bold text-lg flex items-center gap-3 mx-auto sm:mx-0">
                    Start Discovering
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </SignInButton>
                <button className="border border-blue-400 text-blue-400 hover:bg-blue-900/30 px-12 py-4 rounded-full transition-all duration-300 font-semibold text-lg">
                  Watch Demo
                </button>
              </div>

              {/* Feature Highlights */}
              <div className="grid md:grid-cols-3 gap-8 mb-20">
                <Card className="backdrop-blur-md bg-slate-800/40 border border-blue-500/30 shadow-xl card-hover">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-4">AI-Powered Intelligence</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Advanced cultural analysis using Google Gemini AI and Qloo's taste graph technology
                    </p>
                  </CardContent>
                </Card>

                <Card className="backdrop-blur-md bg-slate-800/40 border border-blue-500/30 shadow-xl card-hover">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Globe className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-4">Cross-Domain Magic</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Connect movies to books, music to restaurants, brands to experiences across 8+ domains
                    </p>
                  </CardContent>
                </Card>

                <Card className="backdrop-blur-md bg-slate-800/40 border border-blue-500/30 shadow-xl card-hover">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Palette className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-4">Personalized Insights</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Deep cultural theme analysis with conversational explanations for every recommendation
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Benefits Section */}
              <div className="bg-gradient-to-r from-slate-800/60 to-blue-900/60 backdrop-blur-md rounded-3xl p-12 mb-20 border border-blue-500/30">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Why Choose TasteSync?
                </h2>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-lg text-slate-100">Lightning Fast Results</h4>
                        <p className="text-slate-300">Get personalized recommendations in under 3 seconds</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-lg text-slate-100">Smart Caching</h4>
                        <p className="text-slate-300">Intelligent multi-layer caching for instant repeated queries</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-lg text-slate-100">Privacy First</h4>
                        <p className="text-slate-300">Your data is secure with enterprise-grade authentication</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-lg text-slate-100">Always Learning</h4>
                        <p className="text-slate-300">AI models improve with every interaction and user feedback</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-lg text-slate-100">Expert Explanations</h4>
                        <p className="text-slate-300">Understand why each recommendation fits your unique taste</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-lg text-slate-100">Unlimited Discovery</h4>
                        <p className="text-slate-300">Explore endless connections across entertainment and lifestyle</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Ready to Expand Your Horizons?
                </h2>
                <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                  Join thousands of users who've discovered their next favorite things through AI-powered taste intelligence.
                </p>
                <SignInButton mode="modal">
                  <button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-16 py-5 rounded-full transition-all duration-300 shadow-2xl hover:shadow-3xl button-glow font-bold text-xl">
                    Start Your Journey Now
                  </button>
                </SignInButton>
              </div>
            </div>
          </section>
        </SignedOut>

        <SignedIn>
          {/* Recommendation Form for Authenticated Users */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-indigo-500 to-cyan-400 bg-clip-text text-transparent mb-6">
                  Discover Your Next Favorite Thing
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed mb-8">
                  Welcome back! Enter what you love, and we'll find amazing recommendations across movies, books, music, restaurants, and more.
                </p>
                
                {/* Revolutionary AI Features Access */}
                <div className="mb-8">
                  <Link
                    href="/discover"
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-600 to-orange-700 hover:from-yellow-700 hover:to-orange-800 text-white px-8 py-4 rounded-xl transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl group"
                  >
                    <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    ⚡ Revolutionary AI Features
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <p className="text-slate-400 text-sm mt-2">
                    Explore cutting-edge experimental features
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <RecommendationForm onSubmit={handleSubmit} loading={loading} />

                {error && (
                  <Card className="border-red-400/30 bg-red-900/30 backdrop-blur-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 text-red-200">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold">Error</h3>
                          <p className="text-sm">{error}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {response && (
                  <div className="space-y-6">
                    <RecommendationResults response={response} />
                  </div>
                )}
              </div>
            </div>
          </section>
        </SignedIn>

        {/* Stats Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">50K+</div>
              <p className="text-slate-300">Recommendations Generated</p>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">8</div>
              <p className="text-slate-300">Entertainment Domains</p>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">95%</div>
              <p className="text-slate-300">User Satisfaction</p>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">2.5s</div>
              <p className="text-slate-300">Average Response Time</p>
            </div>
          </div>
        </section>

        <footer className="container mx-auto px-4 py-12">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                TasteSync
              </span>
            </div>
            <p className="text-slate-300">
              © 2025 TasteSync. Powered by AI & Cultural Intelligence.
            </p>
            <div className="flex justify-center gap-6 text-sm text-slate-400">
              <Link href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-blue-400 transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-blue-400 transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}