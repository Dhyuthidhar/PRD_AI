import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function GET(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/auth/me'
  
  try {
    // Rate limiting: 60 requests per minute per IP
    enforceRateLimit(request, { limit: 60, windowMs: 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', userId)
      .single()

    if (error || !data) {
      throw new Error('User not found')
    }

    Logger.info('User profile fetched', {
      requestId,
      route,
      userId,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ user: data })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to fetch user profile', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
