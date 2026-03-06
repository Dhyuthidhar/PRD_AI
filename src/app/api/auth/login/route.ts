import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/auth'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/auth/login'
  
  try {
    // Rate limiting: 5 login attempts per 15 minutes
    enforceRateLimit(request, { limit: 5, windowMs: 15 * 60 * 1000 })
    
    const { email, password } = validateBody(schemas.auth.login, await parseJson(request))
    
    const user = await authService.login({ email, password })
    
    Logger.info('Login successful', {
      requestId,
      route,
      userId: user.id,
      durationMs: Date.now() - startTime
    })
    
    const response = NextResponse.json({ user }, { status: 200 })
    
    // Set access token (15 minutes)
    response.cookies.set('access-token', user.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 // 15 minutes
    })
    
    // Set refresh token (7 days)
    response.cookies.set('refresh-token', user.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })
    
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Login failed', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
