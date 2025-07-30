'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface ApiExample {
  title: string
  description: string
  method: string
  endpoint: string
  requestBody?: any
  responseExample: any
}

const apiExamples: ApiExample[] = [
  {
    title: 'Single Entity Recommendation',
    description: 'Get recommendations based on a single artist',
    method: 'POST',
    endpoint: '/api/v1/recommendations',
    requestBody: {
      entities: [
        {
          name: 'Radiohead',
          type: 'artist'
        }
      ],
      limit: 5,
      includeExplanations: true
    },
    responseExample: {
      success: true,
      input: [{ name: 'Radiohead', type: 'artist' }],
      recommendations: {
        movie: [
          {
            id: 'tt0468569',
            name: 'The Dark Knight',
            type: 'movie',
            confidence: 0.85,
            explanation: 'Like Radiohead\'s complex layered compositions, The Dark Knight features intricate storytelling with dark, atmospheric themes.',
            metadata: { year: 2008, director: 'Christopher Nolan' }
          }
        ],
        book: [
          {
            id: 'book_1984',
            name: '1984',
            type: 'book',
            confidence: 0.78,
            explanation: 'Radiohead\'s dystopian themes align with Orwell\'s exploration of surveillance and technological anxiety.',
            metadata: { author: 'George Orwell', year: 1949 }
          }
        ]
      },
      processingTime: 1250,
      cached: false
    }
  },
  {
    title: 'Multiple Entities with Domain Filter',
    description: 'Get recommendations from specific domains based on multiple movies',
    method: 'POST',
    endpoint: '/api/v1/recommendations',
    requestBody: {
      entities: [
        { name: 'Inception', type: 'movie' },
        { name: 'The Dark Knight', type: 'movie' }
      ],
      domains: ['book', 'song', 'restaurant'],
      limit: 3,
      includeExplanations: true
    },
    responseExample: {
      success: true,
      input: [
        { name: 'Inception', type: 'movie' },
        { name: 'The Dark Knight', type: 'movie' }
      ],
      recommendations: {
        book: [
          {
            id: 'book_neuromancer',
            name: 'Neuromancer',
            type: 'book',
            confidence: 0.82,
            explanation: 'Complex narrative structures and themes of reality vs simulation connect these works.',
            metadata: { author: 'William Gibson', year: 1984 }
          }
        ],
        song: [
          {
            id: 'song_paranoid_android',
            name: 'Paranoid Android',
            type: 'song',
            confidence: 0.79,
            explanation: 'Dark, complex compositions that mirror the psychological depth of these films.',
            metadata: { artist: 'Radiohead', album: 'OK Computer' }
          }
        ]
      },
      processingTime: 1450,
      cached: false
    }
  },
  {
    title: 'Health Check',
    description: 'Check system health and service status',
    method: 'GET',
    endpoint: '/api/health',
    responseExample: {
      status: 'healthy',
      timestamp: '2024-01-15T10:30:00Z',
      responseTime: 45,
      services: {
        qloo: { healthy: true, responseTime: 120 },
        gemini: { healthy: true, responseTime: 89 },
        database: { healthy: true, responseTime: 12 },
        redis: { healthy: true, responseTime: 8 }
      },
      version: '1.0.0',
      environment: 'development'
    }
  },
  {
    title: 'User Profile',
    description: 'Get current user profile information',
    method: 'GET',
    endpoint: '/api/user/profile',
    responseExample: {
      id: 'user_123',
      clerk_user_id: 'clerk_456',
      email: 'user@example.com',
      display_name: 'John Doe',
      tier: 'premium',
      usage_limit: 1000,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:30:00Z'
    }
  }
]

const entityTypes = [
  'movie', 'book', 'song', 'artist', 'restaurant', 'brand', 'tv_show', 'podcast', 'game'
]

export default function DocsPage() {
  const [selectedExample, setSelectedExample] = useState<ApiExample>(apiExamples[0])
  const [customRequest, setCustomRequest] = useState({
    entities: [{ name: '', type: 'movie' }],
    domains: [] as string[],
    limit: 5,
    includeExplanations: true
  })

  const addEntity = () => {
    setCustomRequest(prev => ({
      ...prev,
      entities: [...prev.entities, { name: '', type: 'movie' }]
    }))
  }

  const updateEntity = (index: number, field: string, value: string) => {
    setCustomRequest(prev => ({
      ...prev,
      entities: prev.entities.map((entity, i) => 
        i === index ? { ...entity, [field]: value } : entity
      )
    }))
  }

  const removeEntity = (index: number) => {
    setCustomRequest(prev => ({
      ...prev,
      entities: prev.entities.filter((_, i) => i !== index)
    }))
  }

  const toggleDomain = (domain: string) => {
    setCustomRequest(prev => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter(d => d !== domain)
        : [...prev.domains, domain]
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
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
        
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-4">
            Cross-Domain Recommendation Engine API
          </h1>
          <p className="text-xl text-slate-300 mb-6">
            Generate cross-domain taste-based recommendations with explanations
          </p>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="bg-green-600/80 text-green-100 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
              Version 1.0.0
            </div>
            <div className="bg-blue-600/80 text-blue-100 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
              REST API
            </div>
            <div className="bg-purple-600/80 text-purple-100 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
              OpenAPI 3.0
            </div>
            <a 
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-4 py-2 rounded-lg transition-all duration-300 font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              🔗 Interactive API Docs
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-6 sticky top-8">
              <h3 className="text-lg font-semibold mb-4 text-slate-100">API Examples</h3>
              <nav className="space-y-2">
                {apiExamples.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedExample(example)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedExample === example
                        ? 'bg-blue-600/80 text-blue-100 border border-blue-400/50'
                        : 'hover:bg-slate-700/50 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <div className="font-medium">{example.title}</div>
                    <div className="text-sm text-slate-400 mt-1">
                      {example.method} {example.endpoint}
                    </div>
                  </button>
                ))}
              </nav>

              <div className="mt-8 pt-6 border-t border-blue-500/30">
                <h4 className="font-medium mb-3 text-slate-100">Quick Links</h4>
                <div className="space-y-2 text-sm">
                  <a href="#authentication" className="block text-blue-400 hover:text-blue-300 transition-colors">
                    Authentication
                  </a>
                  <a href="#rate-limits" className="block text-blue-400 hover:text-blue-300 transition-colors">
                    Rate Limits
                  </a>
                  <a href="#error-handling" className="block text-blue-400 hover:text-blue-300 transition-colors">
                    Error Handling
                  </a>
                  <a href="#sdks" className="block text-blue-400 hover:text-blue-300 transition-colors">
                    SDKs & Libraries
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* API Example */}
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg">
              <div className="p-6 border-b border-blue-500/30">
                <h2 className="text-2xl font-semibold mb-2 text-slate-100">{selectedExample.title}</h2>
                <p className="text-slate-300">{selectedExample.description}</p>
                <div className="mt-4 flex items-center gap-4">
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedExample.method === 'GET' 
                      ? 'bg-green-600/80 text-green-100'
                      : 'bg-blue-600/80 text-blue-100'
                  }`}>
                    {selectedExample.method}
                  </span>
                  <code className="bg-slate-700/60 text-slate-200 px-3 py-1 rounded text-sm">
                    {selectedExample.endpoint}
                  </code>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Request */}
                  {selectedExample.requestBody && (
                    <div>
                      <h3 className="font-semibold mb-3 text-slate-100">Request Body</h3>
                      <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700">
                        {JSON.stringify(selectedExample.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Response */}
                  <div>
                    <h3 className="font-semibold mb-3 text-slate-100">Response Example</h3>
                    <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700">
                      {JSON.stringify(selectedExample.responseExample, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* cURL Example */}
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 text-slate-100">cURL Example</h3>
                  <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700">
                    {selectedExample.method === 'GET' 
                      ? `curl -X GET http://localhost:3000${selectedExample.endpoint} \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
                      : `curl -X POST http://localhost:3000${selectedExample.endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '${JSON.stringify(selectedExample.requestBody, null, 2)}'`
                    }
                  </pre>
                </div>
              </div>
            </div>

            {/* Interactive Request Builder */}
            <div className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg">
              <div className="p-6 border-b border-blue-500/30">
                <h2 className="text-2xl font-semibold mb-2 text-slate-100">Try It Out</h2>
                <p className="text-slate-300">Build and test your own API requests</p>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {/* Entities */}
                  <div>
                    <Label className="text-base font-medium text-slate-100">Entities</Label>
                    <p className="text-sm text-slate-400 mb-3">Add 1-5 entities to base recommendations on</p>
                    
                    {customRequest.entities.map((entity, index) => (
                      <div key={index} className="flex gap-3 mb-3">
                        <input
                          type="text"
                          placeholder="Entity name (e.g., Radiohead)"
                          value={entity.name}
                          onChange={(e) => updateEntity(index, 'name', e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-100 placeholder-slate-400"
                        />
                        <Select
                          value={entity.type}
                          onValueChange={(value) => updateEntity(index, 'type', value)}
                        >
                          <SelectTrigger className="w-32 bg-slate-700/50 border-slate-600 text-slate-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600">
                            {entityTypes.map(type => (
                              <SelectItem key={type} value={type} className="text-slate-100 hover:bg-slate-700">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {customRequest.entities.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeEntity(index)}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    
                    {customRequest.entities.length < 5 && (
                      <Button 
                        variant="outline" 
                        onClick={addEntity}
                        className="border-blue-500/50 text-blue-400 hover:bg-blue-900/30 hover:text-blue-300"
                      >
                        Add Entity
                      </Button>
                    )}
                  </div>

                  {/* Domain Filter */}
                  <div>
                    <Label className="text-base font-medium text-slate-100">Domain Filter (Optional)</Label>
                    <p className="text-sm text-slate-400 mb-3">Select specific domains for recommendations</p>
                    <div className="grid grid-cols-3 gap-3">
                      {entityTypes.map(domain => (
                        <div key={domain} className="flex items-center space-x-2">
                          <Checkbox
                            id={domain}
                            checked={customRequest.domains.includes(domain)}
                            onCheckedChange={() => toggleDomain(domain)}
                            className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <Label htmlFor={domain} className="text-sm capitalize text-slate-300">
                            {domain}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Limit */}
                  <div>
                    <Label htmlFor="limit" className="text-base font-medium text-slate-100">
                      Limit per Domain
                    </Label>
                    <input
                      id="limit"
                      type="number"
                      min="1"
                      max="20"
                      value={customRequest.limit}
                      onChange={(e) => setCustomRequest(prev => ({
                        ...prev,
                        limit: parseInt(e.target.value) || 5
                      }))}
                      className="mt-1 w-24 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-100"
                    />
                  </div>

                  {/* Include Explanations */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="explanations"
                      checked={customRequest.includeExplanations}
                      onCheckedChange={(checked) => setCustomRequest(prev => ({
                        ...prev,
                        includeExplanations: checked as boolean
                      }))}
                      className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label htmlFor="explanations" className="text-slate-300">Include explanations</Label>
                  </div>

                  {/* Generated Request */}
                  <div>
                    <Label className="text-base font-medium text-slate-100">Generated Request</Label>
                    <pre className="mt-2 bg-slate-900/80 text-slate-200 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700">
                      {JSON.stringify(customRequest, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Documentation Sections */}
            <div className="space-y-8">
              {/* Authentication */}
              <section id="authentication" className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-slate-100">Authentication</h2>
                <p className="text-slate-300 mb-4">
                  All API requests require authentication using Clerk JWT tokens. Include the token in the Authorization header:
                </p>
                <pre className="bg-slate-900/80 text-slate-200 p-4 rounded-lg text-sm border border-slate-700">
                  Authorization: Bearer &lt;your-jwt-token&gt;
                </pre>
              </section>

              {/* Rate Limits */}
              <section id="rate-limits" className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-slate-100">Rate Limits</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-green-500/30 bg-green-900/20 rounded-lg p-4">
                    <h3 className="font-semibold text-green-400">Free Tier</h3>
                    <p className="text-2xl font-bold text-slate-100">100</p>
                    <p className="text-sm text-slate-400">requests per hour</p>
                  </div>
                  <div className="border border-blue-500/30 bg-blue-900/20 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-400">Premium Tier</h3>
                    <p className="text-2xl font-bold text-slate-100">1,000</p>
                    <p className="text-sm text-slate-400">requests per hour</p>
                  </div>
                  <div className="border border-purple-500/30 bg-purple-900/20 rounded-lg p-4">
                    <h3 className="font-semibold text-purple-400">Enterprise Tier</h3>
                    <p className="text-2xl font-bold text-slate-100">10,000</p>
                    <p className="text-sm text-slate-400">requests per hour</p>
                  </div>
                </div>
              </section>

              {/* Error Handling */}
              <section id="error-handling" className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-slate-100">Error Handling</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-100">Common HTTP Status Codes</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                      <li className="text-slate-300"><code className="bg-slate-700/60 text-slate-200 px-2 py-1 rounded">200</code> - Success</li>
                      <li className="text-slate-300"><code className="bg-slate-700/60 text-slate-200 px-2 py-1 rounded">400</code> - Bad Request (validation errors)</li>
                      <li className="text-slate-300"><code className="bg-slate-700/60 text-slate-200 px-2 py-1 rounded">401</code> - Unauthorized (authentication required)</li>
                      <li className="text-slate-300"><code className="bg-slate-700/60 text-slate-200 px-2 py-1 rounded">429</code> - Too Many Requests (rate limited)</li>
                      <li className="text-slate-300"><code className="bg-slate-700/60 text-slate-200 px-2 py-1 rounded">503</code> - Service Unavailable (with fallback data)</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* SDKs */}
              <section id="sdks" className="bg-slate-800/60 backdrop-blur-md border border-blue-500/30 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-slate-100">SDKs & Libraries</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2 text-slate-100">JavaScript/TypeScript</h3>
                    <pre className="bg-slate-900/80 text-slate-200 p-3 rounded text-sm border border-slate-700">
                      npm install @recommendation-engine/js-sdk
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2 text-slate-100">Python</h3>
                    <pre className="bg-slate-900/80 text-slate-200 p-3 rounded text-sm border border-slate-700">
                      pip install recommendation-engine-python
                    </pre>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}