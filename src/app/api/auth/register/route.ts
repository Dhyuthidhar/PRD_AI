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
  const route = '/api/auth/register'
  
  try {
    // Rate limiting: 3 registrations per hour
    enforceRateLimit(request, { limit: 3, windowMs: 60 * 60 * 1000 })
    
    const { email, password, name, role } = validateBody(schemas.auth.register, await parseJson(request))
    
    const user = await authService.createUser({ email, password, name, role })
    
    Logger.info('Registration successful', {
      requestId,
      route,
      userId: user.id,
      durationMs: Date.now() - startTime
    })
    
    const response = NextResponse.json({ user }, { status: 201 })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Registration failed', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
