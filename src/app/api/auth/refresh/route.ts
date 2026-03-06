import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/auth'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/auth/refresh'
  
  try {
    // Rate limiting: 20 refresh requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 20, windowMs: 10 * 60 * 1000 })
    
    const refreshToken = request.cookies.get('refresh-token')?.value
    
    if (!refreshToken) {
      throw new Error('Refresh token required')
    }
    
    // Refresh tokens
    const tokenPair = await authService.refreshAccessToken(refreshToken)
    
    Logger.info('Token refresh successful', {
      requestId,
      route,
      durationMs: Date.now() - startTime
    })
    
    const response = NextResponse.json({ success: true })
    
    // Set new access token (15 minutes)
    response.cookies.set('access-token', tokenPair.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 // 15 minutes
    })
    
    // Set new refresh token (7 days)
    response.cookies.set('refresh-token', tokenPair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })
    
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Token refresh failed', error, { requestId, route })
    
    // Clear cookies on refresh failure
    const response = NextResponse.json(
      toErrorResponse(error, requestId)
    )
    
    response.cookies.set('access-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    
    response.cookies.set('refresh-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    
    return addRequestIdHeader(response, requestId)
  }
}
