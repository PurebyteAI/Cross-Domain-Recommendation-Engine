'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'

interface OnboardingProps {
    onComplete: () => void
}

export function UserOnboarding({ onComplete }: OnboardingProps) {
    const { user } = useUser()
    const [step, setStep] = useState(1)
    const [preferences, setPreferences] = useState({
        interests: [] as string[],
        experience: '',
        goals: [] as string[]
    })
    const [loading, setLoading] = useState(false)

    const interests = [
        'Music', 'Movies', 'Books', 'Restaurants', 'Art', 'Fashion',
        'Travel', 'Technology', 'Sports', 'Gaming', 'Food', 'Design'
    ]

    const experiences = [
        { value: 'beginner', label: 'New to recommendation systems' },
        { value: 'intermediate', label: 'Some experience with APIs' },
        { value: 'advanced', label: 'Experienced developer' }
    ]

    const goals = [
        'Personal recommendations',
        'Business integration',
        'Research and development',
        'Content discovery',
        'User engagement',
        'Data analysis'
    ]

    const handleInterestToggle = (interest: string) => {
        setPreferences(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }))
    }

    const handleGoalToggle = (goal: string) => {
        setPreferences(prev => ({
            ...prev,
            goals: prev.goals.includes(goal)
                ? prev.goals.filter(g => g !== goal)
                : [...prev.goals, goal]
        }))
    }

    const handleComplete = async () => {
        setLoading(true)
        try {
            // Save onboarding preferences (this could be extended to save to database)
            console.log('Onboarding completed with preferences:', preferences)

            // Update user metadata in Clerk
            if (user) {
                await user.update({
                    unsafeMetadata: {
                        onboardingCompleted: true,
                        preferences
                    }
                })
            }

            onComplete()
        } catch (error) {
            console.error('Error completing onboarding:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Welcome to Cross-Domain Recommendations!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Let&apos;s personalize your experience in just a few steps
                        </p>
                        <div className="flex justify-center mt-4">
                            <div className="flex space-x-2">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step 1: Interests */}
                    {step === 1 && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                                What are you interested in?
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Select the domains you&apos;d like to explore with our recommendation engine.
                            </p>
                            <div className="grid grid-cols-3 gap-3 mb-8">
                                {interests.map((interest) => (
                                    <button
                                        key={interest}
                                        onClick={() => handleInterestToggle(interest)}
                                        className={`p-3 rounded-lg border-2 transition-colors ${preferences.interests.includes(interest)
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        {interest}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={preferences.interests.length === 0}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Experience */}
                    {step === 2 && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                                What&apos;s your experience level?
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                This helps us tailor the interface and documentation to your needs.
                            </p>
                            <div className="space-y-3 mb-8">
                                {experiences.map((exp) => (
                                    <button
                                        key={exp.value}
                                        onClick={() => setPreferences(prev => ({ ...prev, experience: exp.value }))}
                                        className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${preferences.experience === exp.value
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {exp.label}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between">
                                <button
                                    onClick={() => setStep(1)}
                                    className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 px-6 py-2"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    disabled={!preferences.experience}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Goals */}
                    {step === 3 && (
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                                What are your goals?
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Select what you plan to do with our recommendation engine.
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {goals.map((goal) => (
                                    <button
                                        key={goal}
                                        onClick={() => handleGoalToggle(goal)}
                                        className={`p-3 rounded-lg border-2 transition-colors ${preferences.goals.includes(goal)
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        {goal}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between">
                                <button
                                    onClick={() => setStep(2)}
                                    className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 px-6 py-2"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleComplete}
                                    disabled={preferences.goals.length === 0 || loading}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Completing...
                                        </>
                                    ) : (
                                        'Complete Setup'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}