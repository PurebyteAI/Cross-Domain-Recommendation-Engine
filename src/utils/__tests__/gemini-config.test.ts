import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    getRecommendedModel,
    getModelProfile,
    validateModelChoice,
    createOptimizedGeminiService,
    logModelMetrics,
    MODEL_PROFILES
} from '../gemini-config'

// Mock the GeminiService
vi.mock('@/services/gemini.service', () => ({
    GeminiService: vi.fn().mockImplementation((config) => ({
        config,
        getModelInfo: () => ({ model: config?.model || 'gemini-2.0-flash-lite' })
    }))
}))

describe('gemini-config utilities', () => {
    beforeEach(() => {
        // Mock console methods
        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'warn').mockImplementation(() => { })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('getRecommendedModel', () => {
        it('should return correct model for cost-effective use case', () => {
            expect(getRecommendedModel('cost-effective')).toBe('gemini-2.0-flash-lite')
        })

        it('should return correct model for balanced use case', () => {
            expect(getRecommendedModel('balanced')).toBe('gemini-1.5-flash')
        })

        it('should return correct model for high-quality use case', () => {
            expect(getRecommendedModel('high-quality')).toBe('gemini-1.5-pro')
        })

        it('should return correct model for experimental use case', () => {
            expect(getRecommendedModel('experimental')).toBe('gemini-2.0-flash-exp')
        })

        it('should return default model for unknown use case', () => {
            // @ts-ignore - testing invalid input
            expect(getRecommendedModel('unknown')).toBe('gemini-2.0-flash-lite')
        })
    })

    describe('getModelProfile', () => {
        it('should return profile for existing model', () => {
            const profile = getModelProfile('gemini-2.0-flash-lite')
            expect(profile).toBeDefined()
            expect(profile?.model).toBe('gemini-2.0-flash-lite')
            expect(profile?.speed).toBe('fast')
            expect(profile?.quality).toBe('good')
            expect(profile?.costTier).toBe('low')
        })

        it('should return undefined for non-existing model', () => {
            const profile = getModelProfile('non-existing-model')
            expect(profile).toBeUndefined()
        })

        it('should have all expected models in profiles', () => {
            const expectedModels = [
                'gemini-2.0-flash-lite',
                'gemini-1.5-flash',
                'gemini-1.5-pro',
                'gemini-2.0-flash-exp'
            ]

            expectedModels.forEach(model => {
                const profile = getModelProfile(model)
                expect(profile).toBeDefined()
                expect(profile?.model).toBe(model)
            })
        })
    })

    describe('validateModelChoice', () => {
        it('should validate optimal model choice', () => {
            const result = validateModelChoice('gemini-2.0-flash-lite', 'high')
            expect(result.isOptimal).toBe(true)
            expect(result.suggestion).toBeUndefined()
            expect(result.reason).toBeUndefined()
        })

        it('should suggest faster model for high volume with slow model', () => {
            const result = validateModelChoice('gemini-1.5-pro', 'high')
            expect(result.isOptimal).toBe(false)
            expect(result.suggestion).toBe('gemini-2.0-flash-lite')
            expect(result.reason).toContain('faster model')
        })

        it('should suggest cost-effective model for low volume with expensive model', () => {
            const result = validateModelChoice('gemini-1.5-pro', 'low')
            expect(result.isOptimal).toBe(false)
            expect(result.suggestion).toBe('gemini-2.0-flash-lite')
            expect(result.reason).toContain('cost-effective')
        })

        it('should handle non-existing model', () => {
            const result = validateModelChoice('non-existing-model', 'medium')
            expect(result.isOptimal).toBe(false)
            expect(result.suggestion).toBe('gemini-1.5-flash')
            expect(result.reason).toContain('not found')
        })
    })

    describe('createOptimizedGeminiService', () => {
        it('should create service optimized for development', () => {
            const service = createOptimizedGeminiService('development')
            expect(service).toBeDefined()
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Initializing Gemini service for development')
            )
        })

        it('should create service optimized for staging', () => {
            const service = createOptimizedGeminiService('staging')
            expect(service).toBeDefined()
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Initializing Gemini service for staging')
            )
        })

        it('should create service optimized for production', () => {
            const service = createOptimizedGeminiService('production')
            expect(service).toBeDefined()
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Initializing Gemini service for production')
            )
        })

        it('should use environment variable in production', () => {
            process.env.GEMINI_MODEL = 'gemini-1.5-pro'
            const service = createOptimizedGeminiService('production')
            expect(service).toBeDefined()
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('gemini-1.5-pro')
            )
            delete process.env.GEMINI_MODEL
        })

        it('should log model profile information', () => {
            createOptimizedGeminiService('development')
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Model profile:')
            )
        })
    })

    describe('logModelMetrics', () => {
        it('should log successful response', () => {
            logModelMetrics('gemini-2.0-flash-lite', 1000, true)
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('✅ gemini-2.0-flash-lite | 1000ms | fast speed')
            )
        })

        it('should log failed response', () => {
            logModelMetrics('gemini-1.5-pro', 2000, false)
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('❌ gemini-1.5-pro | 2000ms | medium speed')
            )
        })

        it('should warn about slow responses', () => {
            logModelMetrics('gemini-1.5-pro', 6000, true)
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Slow response from gemini-1.5-pro: 6000ms')
            )
        })

        it('should warn about fast model failures', () => {
            logModelMetrics('gemini-2.0-flash-lite', 1000, false)
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Fast model gemini-2.0-flash-lite failed')
            )
        })

        it('should handle unknown model gracefully', () => {
            logModelMetrics('unknown-model', 1000, true)
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('✅ unknown-model | 1000ms | unknown speed')
            )
        })
    })

    describe('MODEL_PROFILES', () => {
        it('should have valid structure for all profiles', () => {
            MODEL_PROFILES.forEach(profile => {
                expect(profile).toHaveProperty('model')
                expect(profile).toHaveProperty('speed')
                expect(profile).toHaveProperty('quality')
                expect(profile).toHaveProperty('costTier')
                expect(profile).toHaveProperty('recommendedFor')

                expect(typeof profile.model).toBe('string')
                expect(['fast', 'medium', 'slow']).toContain(profile.speed)
                expect(['good', 'better', 'best']).toContain(profile.quality)
                expect(['low', 'medium', 'high']).toContain(profile.costTier)
                expect(Array.isArray(profile.recommendedFor)).toBe(true)
            })
        })

        it('should have unique model names', () => {
            const modelNames = MODEL_PROFILES.map(p => p.model)
            const uniqueNames = [...new Set(modelNames)]
            expect(modelNames.length).toBe(uniqueNames.length)
        })

        it('should include recommended models', () => {
            const modelNames = MODEL_PROFILES.map(p => p.model)
            expect(modelNames).toContain('gemini-2.0-flash-lite')
            expect(modelNames).toContain('gemini-1.5-flash')
            expect(modelNames).toContain('gemini-1.5-pro')
        })
    })
})