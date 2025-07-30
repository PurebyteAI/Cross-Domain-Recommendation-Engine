import { UserTasteHistoryService, UserProfileService } from '../lib/database'
import { supabaseAdmin } from '../lib/supabase'

export interface UserPreferences {
  preferredDomains: Record<string, number>
  commonThemes: Record<string, number>
  averageConfidence: number
  totalInteractions: number
  lastUpdated: string
  personalityProfile?: {
    adventurous: number // 0-1 scale
    mainstream: number // 0-1 scale
    nostalgic: number // 0-1 scale
    experimental: number // 0-1 scale
  }
}

export interface PersonalizationWeights {
  historyWeight: number
  popularityWeight: number
  noveltyWeight: number
  confidenceThreshold: number
}

export class PersonalizationService {
  private static readonly DEFAULT_WEIGHTS: PersonalizationWeights = {
    historyWeight: 0.7,
    popularityWeight: 0.2,
    noveltyWeight: 0.1,
    confidenceThreshold: 0.6
  }

  /**
   * Learn user preferences from their taste history
   */
  static async learnUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      // Get user's taste history
      const historyResult = await UserTasteHistoryService.getByUserId(userId, 100)
      
      if (!historyResult.success || !historyResult.data.length) {
        return null
      }

      const preferences = this.analyzeUserTastePatterns(historyResult.data)
      
      // Update user profile with learned preferences
      await this.updateUserPreferences(userId, preferences)
      
      return preferences
    } catch (error) {
      console.error('Error learning user preferences:', error)
      return null
    }
  }

  /**
   * Get personalized recommendations based on user preferences
   */
  static async personalizeRecommendations(
    userId: string,
    baseRecommendations: any[],
    weights?: Partial<PersonalizationWeights>
  ): Promise<any[]> {
    try {
      const userPreferences = await this.getUserPreferences(userId)
      if (!userPreferences) {
        return baseRecommendations
      }

      const finalWeights = { ...this.DEFAULT_WEIGHTS, ...weights }
      
      // Score and rank recommendations based on user preferences
      const scoredRecommendations = baseRecommendations.map(rec => ({
        ...rec,
        personalizedScore: this.calculatePersonalizedScore(rec, userPreferences, finalWeights)
      }))

      // Sort by personalized score
      scoredRecommendations.sort((a, b) => b.personalizedScore - a.personalizedScore)

      // Apply diversity filter to avoid too similar recommendations
      return this.applyDiversityFilter(scoredRecommendations, userPreferences)
    } catch (error) {
      console.error('Error personalizing recommendations:', error)
      return baseRecommendations
    }
  }

  /**
   * Analyze user taste patterns from history
   */
  private static analyzeUserTastePatterns(history: any[]): UserPreferences {
    const patterns: UserPreferences = {
      preferredDomains: {},
      commonThemes: {},
      averageConfidence: 0,
      totalInteractions: history.length,
      lastUpdated: new Date().toISOString()
    }

    let totalConfidence = 0
    let confidenceCount = 0
    const themeFrequency: Record<string, number> = {}
    const domainInteractions: Record<string, { count: number; satisfaction: number }> = {}

    for (const record of history) {
      try {
        const recommendations = record.recommendations || {}
        
        // Analyze domain preferences and satisfaction
        for (const [domain, recs] of Object.entries(recommendations)) {
          if (!Array.isArray(recs)) continue
          
          if (!domainInteractions[domain]) {
            domainInteractions[domain] = { count: 0, satisfaction: 0 }
          }
          
          domainInteractions[domain].count += recs.length
          
          // Analyze confidence scores and themes
          for (const rec of recs) {
            if (rec.confidence) {
              totalConfidence += rec.confidence
              confidenceCount++
              domainInteractions[domain].satisfaction += rec.confidence
            }
            
            // Extract themes from explanations or metadata
            if (rec.explanation) {
              const themes = this.extractThemesFromText(rec.explanation)
              themes.forEach(theme => {
                themeFrequency[theme] = (themeFrequency[theme] || 0) + 1
              })
            }
          }
        }
      } catch (error) {
        console.error('Error analyzing record:', error)
      }
    }

    // Calculate domain preferences based on interaction count and satisfaction
    for (const [domain, stats] of Object.entries(domainInteractions)) {
      const avgSatisfaction = stats.count > 0 ? stats.satisfaction / stats.count : 0
      patterns.preferredDomains[domain] = stats.count * avgSatisfaction
    }

    // Normalize domain preferences
    const maxDomainScore = Math.max(...Object.values(patterns.preferredDomains))
    if (maxDomainScore > 0) {
      for (const domain of Object.keys(patterns.preferredDomains)) {
        patterns.preferredDomains[domain] /= maxDomainScore
      }
    }

    // Set common themes (top 10)
    const sortedThemes = Object.entries(themeFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
    
    for (const [theme, frequency] of sortedThemes) {
      patterns.commonThemes[theme] = frequency / history.length
    }

    patterns.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    // Calculate personality profile
    patterns.personalityProfile = this.calculatePersonalityProfile(patterns, history)

    return patterns
  }

  /**
   * Extract themes from recommendation explanations
   */
  private static extractThemesFromText(text: string): string[] {
    const themes: string[] = []
    const themeKeywords = {
      'melancholy': ['melancholy', 'sad', 'somber', 'introspective', 'contemplative'],
      'upbeat': ['upbeat', 'energetic', 'lively', 'cheerful', 'vibrant'],
      'experimental': ['experimental', 'avant-garde', 'innovative', 'unconventional'],
      'nostalgic': ['nostalgic', 'vintage', 'classic', 'retro', 'timeless'],
      'romantic': ['romantic', 'love', 'passionate', 'intimate', 'tender'],
      'dark': ['dark', 'gothic', 'mysterious', 'brooding', 'intense'],
      'minimalist': ['minimalist', 'simple', 'clean', 'sparse', 'understated'],
      'complex': ['complex', 'layered', 'sophisticated', 'intricate', 'nuanced']
    }

    const lowerText = text.toLowerCase()
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        themes.push(theme)
      }
    }

    return themes
  }

  /**
   * Calculate personality profile based on preferences
   */
  private static calculatePersonalityProfile(
    preferences: UserPreferences, 
    history: any[]
  ): UserPreferences['personalityProfile'] {
    const profile = {
      adventurous: 0,
      mainstream: 0,
      nostalgic: 0,
      experimental: 0
    }

    // Calculate adventurous score based on domain diversity
    const domainCount = Object.keys(preferences.preferredDomains).length
    profile.adventurous = Math.min(domainCount / 5, 1) // Normalize to 0-1

    // Calculate experimental score based on confidence with low-confidence items
    const lowConfidenceInteractions = history.filter(record => {
      const recs = Object.values(record.recommendations || {}).flat()
      return recs.some((rec: any) => rec.confidence && rec.confidence < 0.7)
    }).length
    profile.experimental = Math.min(lowConfidenceInteractions / history.length, 1)

    // Calculate nostalgic score based on theme preferences
    profile.nostalgic = preferences.commonThemes['nostalgic'] || 0

    // Calculate mainstream score (inverse of experimental)
    profile.mainstream = 1 - profile.experimental

    return profile
  }

  /**
   * Calculate personalized score for a recommendation
   */
  private static calculatePersonalizedScore(
    recommendation: any,
    preferences: UserPreferences,
    weights: PersonalizationWeights
  ): number {
    let score = 0

    // Base confidence score
    const baseScore = recommendation.confidence || 0.5
    
    // Domain preference boost
    const domainBoost = preferences.preferredDomains[recommendation.type] || 0
    
    // Theme alignment boost
    let themeBoost = 0
    if (recommendation.explanation) {
      const recThemes = this.extractThemesFromText(recommendation.explanation)
      themeBoost = recThemes.reduce((sum, theme) => {
        return sum + (preferences.commonThemes[theme] || 0)
      }, 0) / Math.max(recThemes.length, 1)
    }

    // Novelty penalty/boost based on user personality
    const noveltyFactor = preferences.personalityProfile?.adventurous || 0.5
    const noveltyScore = recommendation.confidence < 0.7 ? noveltyFactor : 1 - noveltyFactor

    // Combine scores
    score = (
      baseScore * weights.historyWeight +
      domainBoost * 0.3 +
      themeBoost * 0.2 +
      noveltyScore * weights.noveltyWeight
    )

    return Math.min(Math.max(score, 0), 1)
  }

  /**
   * Apply diversity filter to recommendations
   */
  private static applyDiversityFilter(
    recommendations: any[],
    preferences: UserPreferences
  ): any[] {
    const filtered: any[] = []
    const seenThemes = new Set<string>()
    const domainCounts: Record<string, number> = {}

    for (const rec of recommendations) {
      const recThemes = rec.explanation ? this.extractThemesFromText(rec.explanation) : []
      const domain = rec.type || 'unknown'
      
      // Check domain diversity (max 3 per domain in top results)
      domainCounts[domain] = (domainCounts[domain] || 0) + 1
      if (domainCounts[domain] > 3 && filtered.length > 10) {
        continue
      }

      // Check theme diversity for top results
      if (filtered.length < 15) {
        const hasNewTheme = recThemes.some(theme => !seenThemes.has(theme))
        if (hasNewTheme || recThemes.length === 0) {
          recThemes.forEach(theme => seenThemes.add(theme))
          filtered.push(rec)
        } else if (filtered.length < 5) {
          // Always include top 5 regardless of theme overlap
          filtered.push(rec)
        }
      } else {
        filtered.push(rec)
      }
    }

    return filtered
  }

  /**
   * Get user preferences from database
   */
  private static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('learned_preferences, preferences_updated_at')
        .eq('id', userId)
        .single()

      if (error || !data?.learned_preferences) {
        return null
      }

      return data.learned_preferences as UserPreferences
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      return null
    }
  }

  /**
   * Update user preferences in database
   */
  private static async updateUserPreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          learned_preferences: preferences,
          preferences_updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating user preferences:', error)
      }
    } catch (error) {
      console.error('Error updating user preferences:', error)
    }
  }

  /**
   * Schedule background preference learning for a user
   */
  static async schedulePreferenceLearning(userId: string): Promise<void> {
    try {
      // Call the background job function
      const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/background-jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'user_preference_analysis',
          data: { userId }
        })
      })

      if (!response.ok) {
        console.error('Failed to schedule preference learning:', await response.text())
      }
    } catch (error) {
      console.error('Error scheduling preference learning:', error)
    }
  }

  /**
   * Get personalization insights for user dashboard
   */
  static async getPersonalizationInsights(userId: string): Promise<any> {
    try {
      const preferences = await this.getUserPreferences(userId)
      if (!preferences) {
        return null
      }

      const topDomains = Object.entries(preferences.preferredDomains)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([domain, score]) => ({ domain, score }))

      const topThemes = Object.entries(preferences.commonThemes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([theme, frequency]) => ({ theme, frequency }))

      return {
        totalInteractions: preferences.totalInteractions,
        averageConfidence: preferences.averageConfidence,
        topDomains,
        topThemes,
        personalityProfile: preferences.personalityProfile,
        lastUpdated: preferences.lastUpdated
      }
    } catch (error) {
      console.error('Error getting personalization insights:', error)
      return null
    }
  }
}