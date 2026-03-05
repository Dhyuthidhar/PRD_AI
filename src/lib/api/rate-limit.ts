import { NextRequest } from 'next/server'
import { ApiError } from './errors'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory rate limiter - per instance only
// TODO: Replace with Upstash Redis for production multi-instance scaling
const rateLimitMap = new Map<string, RateLimitEntry>()

export function enforceRateLimit(
  request: NextRequest,
  options: { limit: number; windowMs: number }
): void {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  const path = new URL(request.url).pathname
  const key = `${ip}:${path}`
  const now = Date.now()
  
  let entry = rateLimitMap.get(key)
  
  if (!entry || now > entry.resetTime) {
    // New window
    entry = { count: 1, resetTime: now + options.windowMs }
    rateLimitMap.set(key, entry)
    return
  }
  
  // Existing window
  if (entry.count >= options.limit) {
    throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests')
  }
  
  entry.count++
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) {
        rateLimitMap.delete(k)
      }
    }
  }
}
