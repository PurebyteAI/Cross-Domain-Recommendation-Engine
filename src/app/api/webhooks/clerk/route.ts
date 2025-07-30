import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { UserProfileService } from '@/services/user-profile.service'

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    )
  }

  // Get the body
  const payload = await request.text()

  // Create a new Svix instance with your secret
  const wh = new Webhook(webhookSecret)

  let evt: {
    type: string
    data: {
      id: string
      email_addresses?: Array<{ email_address: string }>
      first_name?: string
      last_name?: string
    }
  }

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as typeof evt
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  // Handle the webhook
  const eventType = evt.type

  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data)
        break
      case 'user.updated':
        await handleUserUpdated(evt.data)
        break
      case 'user.deleted':
        await handleUserDeleted(evt.data)
        break
      default:
        console.log(`Unhandled webhook event type: ${eventType}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Error handling webhook event ${eventType}:`, error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleUserCreated(userData: {
  id: string
  email_addresses?: Array<{ email_address: string }>
  first_name?: string
  last_name?: string
}) {
  const { id: clerkUserId, email_addresses, first_name, last_name } = userData
  
  if (!email_addresses || email_addresses.length === 0) {
    console.error('User created without email address')
    return
  }

  const email = email_addresses[0].email_address
  const displayName = first_name && last_name 
    ? `${first_name} ${last_name}` 
    : first_name || null

  console.log(`Creating user profile for Clerk user: ${clerkUserId}`)
  
  const profile = await UserProfileService.getOrCreateProfile(
    clerkUserId,
    email,
    displayName
  )

  if (profile) {
    console.log(`User profile created successfully: ${profile.id}`)
  } else {
    console.error('Failed to create user profile')
  }
}

async function handleUserUpdated(userData: {
  id: string
  email_addresses?: Array<{ email_address: string }>
  first_name?: string
  last_name?: string
}) {
  const { id: clerkUserId, email_addresses, first_name, last_name } = userData
  
  if (!email_addresses || email_addresses.length === 0) {
    console.error('User updated without email address')
    return
  }

  const email = email_addresses[0].email_address
  const displayName = first_name && last_name 
    ? `${first_name} ${last_name}` 
    : first_name || null

  console.log(`Updating user profile for Clerk user: ${clerkUserId}`)
  
  const updatedProfile = await UserProfileService.updateProfile(clerkUserId, {
    email,
    display_name: displayName
  })

  if (updatedProfile) {
    console.log(`User profile updated successfully: ${updatedProfile.id}`)
  } else {
    console.error('Failed to update user profile')
  }
}

async function handleUserDeleted(userData: { id: string }) {
  const { id: clerkUserId } = userData
  
  console.log(`Deleting user profile for Clerk user: ${clerkUserId}`)
  
  const deleted = await UserProfileService.deleteProfile(clerkUserId)
  
  if (deleted) {
    console.log(`User profile deleted successfully`)
  } else {
    console.error('Failed to delete user profile')
  }
}