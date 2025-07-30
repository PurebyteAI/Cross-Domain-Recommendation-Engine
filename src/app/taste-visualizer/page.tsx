'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TasteVisualizerPage() {
  const router = useRouter()
  
  useEffect(() => {
    // AR/VR Visualizer feature has been removed
    // Redirect users to the Discover page where they can access other AI features
    router.push('/discover')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-400 mx-auto mb-4"></div>
        <p className="text-slate-300">Redirecting to Discover page...</p>
      </div>
    </div>
  )
}

