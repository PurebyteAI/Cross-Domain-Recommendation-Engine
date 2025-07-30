# Cross-Domain Recommendation Engine

A sophisticated recommendation system that provides cross-domain taste-based recommendations with AI-generated explanations. Built with Next.js, TypeScript, and Google Gemini AI.

## Features

- **Cross-Domain Recommendations**: Get recommendations across different domains (movies, books, music, restaurants, etc.)
- **AI-Powered Explanations**: Contextual explanations for recommendations using Google Gemini
- **Cultural Theme Analysis**: Advanced taste profiling using Qloo API
- **Multi-Layer Caching**: L1 (in-memory), L2 (Redis), and L3 (database) caching
- **User Authentication**: Secure authentication with Clerk
- **Rate Limiting**: Tiered rate limiting based on user subscription
- **Comprehensive Testing**: Full test coverage with Vitest

## Getting Started

### Prerequisites

- Node.js 18+ 
- Redis server
- Google Gemini API key
- Qloo API key
- Clerk authentication keys
- Supabase database

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env.local`:
```bash
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-lite

# Qloo API
QLOO_API_KEY=your_qloo_api_key
QLOO_API_URL=https://hackathon.api.qloo.com

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Redis Cache
REDIS_URL=redis://localhost:6379
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Google Gemini Configuration

The application supports configurable Gemini models through environment variables:

### Supported Models

- `gemini-1.5-flash` (default fallback)
- `gemini-1.5-pro`
- `gemini-2.0-flash-lite` (recommended)
- `gemini-2.0-flash-exp`
- `gemini-pro`
- `gemini-pro-vision`

### Configuration Options

Set the model in your `.env.local` file:
```bash
GEMINI_MODEL=gemini-2.0-flash-lite
```

### Programmatic Configuration

You can also configure the Gemini service programmatically:

```typescript
import { GeminiService } from '@/services/gemini.service'

// Create with custom configuration
const geminiService = new GeminiService({
  apiKey: 'your-api-key',
  model: 'gemini-2.0-flash-lite',
  temperature: 0.7,
  maxOutputTokens: 200,
  retryConfig: {
    maxRetries: 3,
    backoffMultiplier: 1.5,
    initialDelay: 500,
    maxDelay: 5000
  }
})

// Update model at runtime
geminiService.updateModelConfig({
  model: 'gemini-1.5-pro',
  temperature: 0.5
})

// Get current model info
const modelInfo = geminiService.getModelInfo()
console.log(`Current model: ${modelInfo.model}`)
```

### Advanced Configuration Utilities

The application includes utility functions for optimal model selection:

```typescript
import { 
  getRecommendedModel, 
  validateModelChoice, 
  createOptimizedGeminiService,
  getModelProfile,
  logModelMetrics 
} from '@/utils/gemini-config'

// Get recommended model for your use case
const model = getRecommendedModel('cost-effective') // or 'balanced', 'high-quality', 'experimental'

// Validate your model choice
const validation = validateModelChoice('gemini-1.5-pro', 'high') // volume: 'low', 'medium', 'high'
if (!validation.isOptimal) {
  console.log(`Consider switching to: ${validation.suggestion}`)
  console.log(`Reason: ${validation.reason}`)
}

// Create environment-optimized service
const service = createOptimizedGeminiService('production') // or 'development', 'staging'

// Get model performance profile
const profile = getModelProfile('gemini-2.0-flash-lite')
console.log(`Speed: ${profile.speed}, Quality: ${profile.quality}, Cost: ${profile.costTier}`)

// Log performance metrics
const startTime = Date.now()
// ... make API call ...
const responseTime = Date.now() - startTime
logModelMetrics('gemini-2.0-flash-lite', responseTime, true)
```

### Model Performance Profiles

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| `gemini-2.0-flash-lite` | Fast | Good | Low | High-volume, real-time, cost-sensitive |
| `gemini-1.5-flash` | Fast | Better | Medium | Balanced, general-purpose |
| `gemini-1.5-pro` | Medium | Best | High | High-quality, complex reasoning, premium |
| `gemini-2.0-flash-exp` | Fast | Better | Medium | Experimental, latest features |

## Testing

Run the test suite:
```bash
npm run test        # Interactive mode
npm run test:run    # Run once
npm run test:ui     # UI mode
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
