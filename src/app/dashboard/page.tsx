'use client'

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { UserProfile } from '@/types/database'
import { UserOnboarding } from '@/components/onboarding'
import { UsageDashboard } from '@/components/usage-dashboard'
import { 
  Sparkles, 
  Music, 
  Book, 
  Film, 
  TrendingUp, 
  Zap, 
  Globe, 
  Activity,
  Star,
  Crown,
  Calendar,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
    const { user, isLoaded } = useUser()
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [showOnboarding, setShowOnboarding] = useState(false)

    useEffect(() => {
        if (isLoaded && user) {
            // Check if user has completed onboarding
            const onboardingCompleted = user.unsafeMetadata?.onboardingCompleted
            if (!onboardingCompleted) {
                setShowOnboarding(true)
                setLoading(false)
            } else {
                // Fetch or create user profile
                fetchUserProfile()
            }
        }
    }, [isLoaded, user])

    const fetchUserProfile = async () => {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (response.ok) {
                const profile = await response.json()
                setUserProfile(profile)
            } else {
                console.error('Failed to fetch user profile')
            }
        } catch (error) {
            console.error('Error fetching user profile:', error)
        } finally {
            setLoading(false)
        }
    }

    if (!isLoaded || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                </div>
                
                <div className="text-center relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-slate-300 text-lg">Loading your personalized dashboard...</p>
                </div>
            </div>
        )
    }

    if (showOnboarding) {
        return (
            <>
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
                    <div className="container mx-auto px-4 py-8">
                        <header className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                    TasteSync
                                </h1>
                            </div>
                            <UserButton />
                        </header>
                    </div>
                </div>
                <UserOnboarding onComplete={() => {
                    setShowOnboarding(false)
                    fetchUserProfile()
                }} />
            </>
        )
    }

    const getTierIcon = (tier: string) => {
        switch (tier) {
            case 'premium': return <Crown className="w-4 h-4" />
            case 'enterprise': return <Star className="w-4 h-4" />
            default: return <Sparkles className="w-4 h-4" />
        }
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'premium': return 'from-purple-500 to-pink-500'
            case 'enterprise': return 'from-yellow-500 to-orange-500'
            default: return 'from-blue-500 to-teal-500'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 rounded-full blur-3xl animate-pulse delay-700"></div>
                <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <div className="relative z-10">
                {/* Header */}
                <header className="container mx-auto px-4 py-6">
                    <nav className="flex justify-between items-center backdrop-blur-md bg-slate-800/20 rounded-full px-6 py-3 border border-blue-500/30 shadow-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                TasteSync
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link 
                              href="/" 
                              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-4 py-2 rounded-lg transition-all duration-300 font-medium shadow-lg hover:shadow-xl"
                            >
                              <Sparkles className="w-4 h-4" />
                              Discover
                            </Link>
                            <UserButton />
                        </div>
                    </nav>
                </header>

                <div className="container mx-auto px-4 py-8">
                    {/* Welcome Section */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-indigo-500 to-cyan-400 bg-clip-text text-transparent mb-4">
                            Welcome back!
                        </h1>
                        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-6">
                            Hey {user?.firstName || user?.emailAddresses[0]?.emailAddress.split('@')[0]}, 
                            ready to discover amazing recommendations?
                        </p>
                        
                        {/* Prominent Discover Button */}
                        <div className="mb-8">
                            <Link 
                              href="/"
                              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-8 py-4 rounded-xl transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl"
                            >
                              <Sparkles className="w-6 h-6" />
                              🚀 Start Discovering Now
                            </Link>
                        </div>
                        
                        <p className="text-slate-400 text-sm">
                            Or explore your dashboard stats below
                        </p>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center`}>
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-2xl font-bold text-slate-100">156</span>
                            </div>
                            <h3 className="font-semibold text-slate-100 mb-1">Recommendations</h3>
                            <p className="text-sm text-slate-300">Total generated</p>
                        </div>

                        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center`}>
                                    <TrendingUp className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-2xl font-bold text-slate-100">89%</span>
                            </div>
                            <h3 className="font-semibold text-slate-100 mb-1">Match Rate</h3>
                            <p className="text-sm text-slate-300">Accuracy score</p>
                        </div>

                        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl flex items-center justify-center`}>
                                    <Globe className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-2xl font-bold text-slate-100">9</span>
                            </div>
                            <h3 className="font-semibold text-slate-100 mb-1">Domains</h3>
                            <p className="text-sm text-slate-300">Connected</p>
                        </div>

                        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 bg-gradient-to-br ${getTierColor(userProfile?.tier || 'free')} rounded-xl flex items-center justify-center`}>
                                    {getTierIcon(userProfile?.tier || 'free')}
                                </div>
                                <span className="text-2xl font-bold text-slate-100">{userProfile?.usage_limit || 50}</span>
                            </div>
                            <h3 className="font-semibold text-slate-100 mb-1">Daily Limit</h3>
                            <p className="text-sm text-slate-300">Requests remaining</p>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="grid lg:grid-cols-3 gap-8 mb-8">
                        {/* Profile Card */}
                        <div className="lg:col-span-1">
                            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">
                                            {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-100">Profile</h2>
                                        <p className="text-slate-300">Your account details</p>
                                    </div>
                                </div>
                                
                                {userProfile ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-400">Email</label>
                                            <p className="text-slate-100 font-medium">{userProfile.email}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-400">Display Name</label>
                                            <p className="text-slate-100 font-medium">
                                                {userProfile.display_name || 'Not set'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-400">Plan</label>
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${getTierColor(userProfile?.tier || 'free')} text-white mt-1`}>
                                                {getTierIcon(userProfile?.tier || 'free')}
                                                {userProfile?.tier ? 
                                                    userProfile.tier.charAt(0).toUpperCase() + userProfile.tier.slice(1) : 
                                                    'Free'
                                                }
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-400">Member Since</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <p className="text-slate-100 font-medium">
                                                    {userProfile?.created_at ? 
                                                        new Date(userProfile.created_at).toLocaleDateString() : 
                                                        'Recently joined'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-pulse space-y-4">
                                        <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                                        <div className="h-4 bg-slate-600 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-600 rounded w-2/3"></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300">
                                <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-blue-400" />
                                    Quick Actions
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Link 
                                        href="/"
                                        className="group p-6 bg-gradient-to-br from-blue-600/20 to-indigo-700/20 border-2 border-blue-500/50 hover:border-blue-400 rounded-xl transition-all duration-300 hover:bg-blue-900/40 block relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-indigo-700/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative z-10">
                                            <div className="text-blue-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                                                <Sparkles className="w-8 h-8" />
                                            </div>
                                            <h3 className="font-bold text-slate-100 mb-2 group-hover:text-blue-300 text-lg">
                                                🚀 Start Discovering
                                            </h3>
                                            <p className="text-sm text-slate-300">
                                                Get personalized recommendations across all domains
                                            </p>
                                        </div>
                                    </Link>

                                    <button 
                                        onClick={() => window.open('/api/docs', '_blank')}
                                        className="group p-6 border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 rounded-xl transition-all duration-300 hover:bg-cyan-900/30"
                                    >
                                        <div className="text-cyan-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                                            <Book className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-cyan-300">
                                            API Documentation
                                        </h3>
                                        <p className="text-sm text-slate-300">
                                            View API documentation and integration examples
                                        </p>
                                    </button>

                                    <Link
                                        href="/health"
                                        className="group p-6 border-2 border-dashed border-indigo-500/50 hover:border-indigo-400 rounded-xl transition-all duration-300 hover:bg-indigo-900/30 block"
                                    >
                                        <div className="text-indigo-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                                            <Activity className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-indigo-300">
                                            System Health
                                        </h3>
                                        <p className="text-sm text-slate-300">
                                            Check system status and service health
                                        </p>
                                    </Link>

                                    <button className="group p-6 border-2 border-dashed border-purple-500/50 hover:border-purple-400 rounded-xl transition-all duration-300 hover:bg-purple-900/30">
                                        <div className="text-purple-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                                            <BarChart3 className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-purple-300">
                                            Usage Analytics
                                        </h3>
                                        <p className="text-sm text-slate-300">
                                            View detailed usage analytics below
                                        </p>
                                    </button>
                                </div>

                                {/* Revolutionary Hackathon Features */}
                                <div className="mt-8">
                                    <h3 className="text-xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
                                        <Sparkles className="w-6 h-6 text-yellow-400" />
                                        Revolutionary AI Features
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                        <Link
                                            href="/discover"
                                            className="group p-6 border-2 border-dashed border-yellow-500/50 hover:border-yellow-400 rounded-xl transition-all duration-300 hover:bg-yellow-900/30 block"
                                        >
                                            <div className="text-yellow-400 text-3xl mb-3 group-hover:scale-110 transition-transform">
                                                <Sparkles className="w-8 h-8" />
                                            </div>
                                            <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-yellow-300">
                                                Discover Features
                                            </h3>
                                            <p className="text-sm text-slate-300">
                                                Explore advanced AI-powered features
                                            </p>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Usage Analytics Dashboard */}
                    <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 shadow-lg">
                        <UsageDashboard />
                    </div>
                </div>
            </div>
        </div>
    )
}