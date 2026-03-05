import { NextRequest } from 'next/server'
import { authService } from '@/lib/auth'
import { ApiError } from './errors'

export function getAuthUser(request: NextRequest): { userId: string } {
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token required')
  }

  try {
    const decoded = authService.verifyToken(token)
    return { userId: decoded.userId }
  } catch (error) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token')
  }
}
