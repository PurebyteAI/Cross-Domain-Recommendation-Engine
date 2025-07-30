'use client'

import Link from 'next/link'

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-600/20 to-indigo-700/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>
      
      <div className="relative z-10">
        {/* Navigation Header */}
        <nav className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center backdrop-blur-md bg-slate-800/40 rounded-full px-6 py-3 border border-blue-500/30 shadow-lg">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">T</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                TasteSync
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="text-slate-400 hover:text-blue-400 transition-colors px-3 py-2 rounded-lg hover:bg-blue-900/20 font-medium text-sm"
              >
                🏠 Back to App
              </Link>
              <Link 
                href="/dashboard" 
                className="text-slate-400 hover:text-blue-400 transition-colors px-3 py-2 rounded-lg hover:bg-blue-900/20 font-medium text-sm"
              >
                📊 Dashboard
              </Link>
            </div>
          </div>
        </nav>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-6">
              API Documentation
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              Integrate TasteSync's cross-domain recommendation engine into your applications. 
              Get AI-powered cultural intelligence and taste predictions across movies, music, books, restaurants, and more.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-3 rounded-lg transition-all duration-300 font-semibold shadow-lg hover:shadow-xl"
              >
                📚 Interactive API Docs
              </a>
              
              <a 
                href="/api/docs/openapi"
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-slate-300 hover:text-blue-400 transition-colors px-6 py-3 rounded-lg hover:bg-blue-900/30 font-medium border border-blue-500/30"
              >
                📄 OpenAPI Spec
              </a>
            </div>
          </div>

          {/* Quick Start */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-slate-100 mb-6 flex items-center gap-3">
              ⚡ Quick Start
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-slate-700/50 rounded-lg border border-blue-500/20">
                <div className="text-4xl mb-4">🔑</div>
                <h3 className="font-semibold text-slate-100 mb-2">1. Get API Key</h3>
                <p className="text-sm text-slate-300">Sign up and generate your API key from the dashboard</p>
              </div>
              <div className="text-center p-6 bg-slate-700/50 rounded-lg border border-blue-500/20">
                <div className="text-4xl mb-4">📡</div>
                <h3 className="font-semibold text-slate-100 mb-2">2. Make Request</h3>
                <p className="text-sm text-slate-300">Send POST request to /api/v1/recommendations</p>
              </div>
              <div className="text-center p-6 bg-slate-700/50 rounded-lg border border-blue-500/20">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="font-semibold text-slate-100 mb-2">3. Get Results</h3>
                <p className="text-sm text-slate-300">Receive cross-domain recommendations with AI explanations</p>
              </div>
            </div>
          </div>

          {/* Example API Call */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-slate-100 mb-6">🔥 Example API Call</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-100 mb-4">Request</h3>
                <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700">
{`curl -X POST "http://localhost:3000/api/v1/recommendations" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "entities": [
      {"name": "Radiohead", "type": "artist"}
    ],
    "domains": ["movie", "book"],
    "limit": 3,
    "includeExplanations": true
  }'`}
                </pre>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-100 mb-4">Response</h3>
                <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700">
{`{
  "success": true,
  "recommendations": {
    "movie": [
      {
        "name": "The Dark Knight",
        "confidence": 0.85,
        "explanation": "Complex themes..."
      }
    ],
    "book": [
      {
        "name": "1984",
        "confidence": 0.78,
        "explanation": "Dystopian themes..."
      }
    ]
  }
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">AI-Powered</h3>
              <p className="text-slate-300 text-sm">Advanced ML for taste predictions</p>
            </div>
            
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Fast Response</h3>
              <p className="text-slate-300 text-sm">Sub-second with intelligent caching</p>
            </div>
            
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Cross-Domain</h3>
              <p className="text-slate-300 text-sm">8+ entertainment domains</p>
            </div>
            
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Secure</h3>
              <p className="text-slate-300 text-sm">Enterprise-grade security</p>
            </div>
          </div>

          {/* Authentication */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-slate-100 mb-6">🔐 Authentication</h2>
            <p className="text-slate-300 mb-4">
              All API requests require authentication using Clerk JWT tokens. Include the token in the Authorization header:
            </p>
            <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg text-sm border border-slate-700">
              Authorization: Bearer &lt;your-jwt-token&gt;
            </pre>
          </div>

          {/* Rate Limits */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-slate-100 mb-6">📊 Rate Limits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-green-500/30 bg-green-900/20 rounded-lg p-6 text-center">
                <h3 className="font-semibold text-green-400 mb-2">Free Tier</h3>
                <p className="text-3xl font-bold text-slate-100 mb-1">100</p>
                <p className="text-sm text-slate-400">requests per hour</p>
              </div>
              <div className="border border-blue-500/30 bg-blue-900/20 rounded-lg p-6 text-center">
                <h3 className="font-semibold text-blue-400 mb-2">Premium Tier</h3>
                <p className="text-3xl font-bold text-slate-100 mb-1">1,000</p>
                <p className="text-sm text-slate-400">requests per hour</p>
              </div>
              <div className="border border-purple-500/30 bg-purple-900/20 rounded-lg p-6 text-center">
                <h3 className="font-semibold text-purple-400 mb-2">Enterprise Tier</h3>
                <p className="text-3xl font-bold text-slate-100 mb-1">10,000</p>
                <p className="text-sm text-slate-400">requests per hour</p>
              </div>
            </div>
          </div>

          {/* Error Handling */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-slate-100 mb-6">⚠️ Error Handling</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <code className="bg-slate-700/60 text-slate-200 px-3 py-1 rounded font-mono">200</code>
                <span className="text-slate-300">Success</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-slate-700/60 text-slate-200 px-3 py-1 rounded font-mono">400</code>
                <span className="text-slate-300">Bad Request (validation errors)</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-slate-700/60 text-slate-200 px-3 py-1 rounded font-mono">401</code>
                <span className="text-slate-300">Unauthorized (authentication required)</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-slate-700/60 text-slate-200 px-3 py-1 rounded font-mono">429</code>
                <span className="text-slate-300">Too Many Requests (rate limited)</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-slate-700/60 text-slate-200 px-3 py-1 rounded font-mono">503</code>
                <span className="text-slate-300">Service Unavailable (with fallback data)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
