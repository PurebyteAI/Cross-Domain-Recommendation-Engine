'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // Only wrap with ClerkProvider if we have a valid publishable key
  if (!publishableKey || publishableKey.includes('your_clerk_publishable_key_here')) {
    return <>{children}</>
  }

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      afterSignInUrl="/"
      afterSignUpUrl="/"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      {children}
    </ClerkProvider>
  )
}