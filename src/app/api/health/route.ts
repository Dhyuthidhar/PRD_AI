import { NextResponse } from 'next/server'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const route = '/api/health'
  
  try {
    // Light rate limiting for health endpoint
    enforceRateLimit(request as any, { limit: 30, windowMs: 60 * 1000 })
    
    const healthData = {
      ok: true,
      time: new Date().toISOString(),
      version: '1.0.0'
    }
    
    Logger.info('Health check', { requestId, route })
    
    const response = NextResponse.json(healthData)
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Health check failed', error, { requestId, route })
    
    const response = NextResponse.json({
      ok: false,
      time: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 503 })
    
    return addRequestIdHeader(response, requestId)
  }
}
