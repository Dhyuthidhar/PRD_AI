import { NextResponse } from 'next/server'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { Logger } from '@/lib/api/logger'

export async function POST() {
  const requestId = createRequestId()
  const route = '/api/auth/logout'
  
  try {
    Logger.info('Logout successful', { requestId, route })
    
    const response = NextResponse.json({ message: 'Logged out successfully' })
    
    // Clear cookie with same hardened settings
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })

    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Logout failed', error, { requestId, route })
    const response = NextResponse.json({ message: 'Logged out successfully' })
    return addRequestIdHeader(response, requestId)
  }
}
