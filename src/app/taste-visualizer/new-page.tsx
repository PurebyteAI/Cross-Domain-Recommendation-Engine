'use client'

import { redirect } from 'next/navigation'

export default function TasteVisualizerPage() {
  // AR/VR Visualizer feature has been removed
  // Redirect users to the Discover page where they can access other AI features
  redirect('/discover')
}
