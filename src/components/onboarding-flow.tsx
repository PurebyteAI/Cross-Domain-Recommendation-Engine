'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

interface OnboardingStep {
  id: string
  title: string
  description: string
  component: React.ComponentType<any>
}

interface UserPreferences {
  favoriteGenres: string[]
  preferredDomains: string[]
  discoveryStyle: 'adventurous' | 'mainstream' | 'balanced'
  interests: string[]
}

const AVAILABLE_DOMAINS = [
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'movies', label: 'Movies', icon: '🎬' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'restaurants', label: 'Restaurants', icon: '🍽️' },
  { id: 'art', label: 'Art', icon: '🎨' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'games', label: 'Games', icon: '🎮' }
]

const DISCOVERY_STYLES = [
  {
    id: 'adventurous',
    title: 'Adventurous Explorer',
    description: 'I love discovering unique, experimental, and unconventional recommendations',
    icon: '🚀'
  },
  {
    id: 'mainstream',
    title: 'Popular Picks',
    description: 'I prefer well-known, highly-rated, and widely appreciated recommendations',
    icon: '⭐'
  },
  {
    id: 'balanced',
    title: 'Balanced Mix',
    description: 'I enjoy a mix of popular favorites and hidden gems',
    icon: '⚖️'
  }
]

const SAMPLE_INTERESTS = [
  'Indie Culture', 'Vintage Aesthetics', 'Minimalism', 'Dark Academia',
  'Cottagecore', 'Cyberpunk', 'Art Nouveau', 'Jazz Age', 'Bohemian',
  'Scandinavian Design', 'Japanese Culture', 'Mediterranean Vibes',
  'Urban Street Culture', 'Nature & Outdoors', 'Luxury & Elegance'
]

// Step 1: Welcome
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome to Cross-Domain Recommendations! 🎯
        </CardTitle>
        <CardDescription className="text-lg mt-4">
          Let's personalize your experience by learning about your tastes and preferences.
          This will help us provide better cross-domain recommendations tailored just for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
          {AVAILABLE_DOMAINS.slice(0, 4).map((domain) => (
            <div key={domain.id} className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-2xl mb-2">{domain.icon}</span>
              <span className="text-sm font-medium">{domain.label}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-600 mb-6">
          We'll connect your preferences across music, movies, books, restaurants, and more
          to help you discover amazing new experiences.
        </p>
        <Button onClick={onNext} size="lg" className="px-8">
          Get Started
        </Button>
      </CardContent>
    </Card>
  )
}

// Step 2: Domain Preferences
function DomainPreferencesStep({ 
  preferences, 
  onUpdate, 
  onNext, 
  onBack 
}: { 
  preferences: UserPreferences
  onUpdate: (prefs: Partial<UserPreferences>) => void
  onNext: () => void
  onBack: () => void
}) {
  const handleDomainToggle = (domainId: string) => {
    const newDomains = preferences.preferredDomains.includes(domainId)
      ? preferences.preferredDomains.filter(d => d !== domainId)
      : [...preferences.preferredDomains, domainId]
    
    onUpdate({ preferredDomains: newDomains })
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>What interests you most?</CardTitle>
        <CardDescription>
          Select the domains where you'd like to discover new recommendations.
          You can always change these later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {AVAILABLE_DOMAINS.map((domain) => (
            <div
              key={domain.id}
              className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                preferences.preferredDomains.includes(domain.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleDomainToggle(domain.id)}
            >
              <span className="text-2xl mb-2">{domain.icon}</span>
              <span className="text-sm font-medium text-center">{domain.label}</span>
              {preferences.preferredDomains.includes(domain.id) && (
                <div className="mt-2">
                  <Badge variant="secondary">Selected</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            onClick={onNext} 
            disabled={preferences.preferredDomains.length === 0}
          >
            Continue ({preferences.preferredDomains.length} selected)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 3: Discovery Style
function DiscoveryStyleStep({ 
  preferences, 
  onUpdate, 
  onNext, 
  onBack 
}: { 
  preferences: UserPreferences
  onUpdate: (prefs: Partial<UserPreferences>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>How do you like to discover new things?</CardTitle>
        <CardDescription>
          This helps us understand whether you prefer popular recommendations,
          unique discoveries, or a mix of both.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {DISCOVERY_STYLES.map((style) => (
            <div
              key={style.id}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                preferences.discoveryStyle === style.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onUpdate({ discoveryStyle: style.id as any })}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{style.icon}</span>
                <div>
                  <h3 className="font-semibold">{style.title}</h3>
                  <p className="text-gray-600 text-sm">{style.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            onClick={onNext} 
            disabled={!preferences.discoveryStyle}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 4: Interests & Themes
function InterestsStep({ 
  preferences, 
  onUpdate, 
  onNext, 
  onBack 
}: { 
  preferences: UserPreferences
  onUpdate: (prefs: Partial<UserPreferences>) => void
  onNext: () => void
  onBack: () => void
}) {
  const [customInterest, setCustomInterest] = useState('')

  const handleInterestToggle = (interest: string) => {
    const newInterests = preferences.interests.includes(interest)
      ? preferences.interests.filter(i => i !== interest)
      : [...preferences.interests, interest]
    
    onUpdate({ interests: newInterests })
  }

  const handleAddCustomInterest = () => {
    if (customInterest.trim() && !preferences.interests.includes(customInterest.trim())) {
      onUpdate({ interests: [...preferences.interests, customInterest.trim()] })
      setCustomInterest('')
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>What themes and aesthetics appeal to you?</CardTitle>
        <CardDescription>
          Select cultural themes, aesthetics, or vibes that resonate with you.
          This helps us understand your taste profile across different domains.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-6">
          {SAMPLE_INTERESTS.map((interest) => (
            <Badge
              key={interest}
              variant={preferences.interests.includes(interest) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleInterestToggle(interest)}
            >
              {interest}
              {preferences.interests.includes(interest) && ' ✓'}
            </Badge>
          ))}
        </div>

        <div className="mb-6">
          <Label htmlFor="custom-interest">Add your own interest:</Label>
          <div className="flex space-x-2 mt-2">
            <Input
              id="custom-interest"
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              placeholder="e.g., Film Noir, K-Pop, Mediterranean Cuisine"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomInterest()}
            />
            <Button onClick={handleAddCustomInterest} variant="outline">
              Add
            </Button>
          </div>
        </div>

        {preferences.interests.length > 0 && (
          <div className="mb-6">
            <Label>Your selected interests:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {preferences.interests.map((interest) => (
                <Badge key={interest} variant="secondary">
                  {interest}
                  <button
                    onClick={() => handleInterestToggle(interest)}
                    className="ml-2 text-xs"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Continue ({preferences.interests.length} interests)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 5: Completion
function CompletionStep({ 
  preferences, 
  onComplete, 
  onBack,
  isLoading 
}: { 
  preferences: UserPreferences
  onComplete: () => void
  onBack: () => void
  isLoading: boolean
}) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">You're all set! 🎉</CardTitle>
        <CardDescription>
          Here's a summary of your preferences. You can always update these in your profile settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          <div>
            <h3 className="font-semibold mb-2">Preferred Domains:</h3>
            <div className="flex flex-wrap gap-2">
              {preferences.preferredDomains.map((domainId) => {
                const domain = AVAILABLE_DOMAINS.find(d => d.id === domainId)
                return (
                  <Badge key={domainId} variant="secondary">
                    {domain?.icon} {domain?.label}
                  </Badge>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Discovery Style:</h3>
            <Badge variant="outline">
              {DISCOVERY_STYLES.find(s => s.id === preferences.discoveryStyle)?.title}
            </Badge>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Interests & Themes:</h3>
            <div className="flex flex-wrap gap-2">
              {preferences.interests.slice(0, 8).map((interest) => (
                <Badge key={interest} variant="outline">
                  {interest}
                </Badge>
              ))}
              {preferences.interests.length > 8 && (
                <Badge variant="outline">
                  +{preferences.interests.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800">
            <strong>What's next?</strong> Start exploring recommendations tailored to your taste!
            Our AI will learn from your interactions and get better at suggesting things you'll love.
          </p>
        </div>
        
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={isLoading}>
            Back
          </Button>
          <Button onClick={onComplete} disabled={isLoading}>
            {isLoading ? 'Setting up your profile...' : 'Start Exploring'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Onboarding Component
export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { user } = useUser()
  const [currentStep, setCurrentStep] = useState(0)
  const [preferences, setPreferences] = useState<UserPreferences>({
    favoriteGenres: [],
    preferredDomains: [],
    discoveryStyle: 'balanced',
    interests: []
  })
  const [isLoading, setIsLoading] = useState(false)

  const steps: OnboardingStep[] = [
    { id: 'welcome', title: 'Welcome', description: 'Introduction', component: WelcomeStep },
    { id: 'domains', title: 'Domains', description: 'Select interests', component: DomainPreferencesStep },
    { id: 'style', title: 'Style', description: 'Discovery preferences', component: DiscoveryStyleStep },
    { id: 'interests', title: 'Interests', description: 'Themes & aesthetics', component: InterestsStep },
    { id: 'complete', title: 'Complete', description: 'Finish setup', component: CompletionStep }
  ]

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }))
  }

  const handleComplete = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // Save preferences to user profile
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          onboarding_completed: true,
          preferences: preferences,
          onboarding_completed_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      // Trigger preference learning
      await fetch('/api/user/preferences/learn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      onComplete()
    } catch (error) {
      console.error('Error completing onboarding:', error)
      // Still complete onboarding even if preference saving fails
      onComplete()
    } finally {
      setIsLoading(false)
    }
  }

  const CurrentStepComponent = steps[currentStep].component

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-center space-x-2 mb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].description}
          </p>
        </div>

        {/* Current step */}
        <CurrentStepComponent
          preferences={preferences}
          onUpdate={updatePreferences}
          onNext={() => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))}
          onBack={() => setCurrentStep(prev => Math.max(prev - 1, 0))}
          onComplete={handleComplete}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}