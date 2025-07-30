import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * GET /api/docs/openapi
 * Serve the OpenAPI specification
 */
export async function GET() {
  try {
    const openApiPath = join(process.cwd(), 'docs', 'openapi.json')
    const openApiSpec = await readFile(openApiPath, 'utf-8')
    const spec = JSON.parse(openApiSpec)
    
    // Update server URLs based on environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.recommendation-engine.com'
      : 'http://localhost:3000'
    
    spec.servers = [
      {
        url: baseUrl,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ]
    
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error)
    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    )
  }
}