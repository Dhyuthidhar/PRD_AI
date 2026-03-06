import { NextRequest } from 'next/server'
import { authService } from '@/lib/auth'
import { ApiError } from './errors'

export function getAuthUser(request: NextRequest): { userId: string } {
  const accessToken = request.cookies.get('access-token')?.value
  
  if (!accessToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Access token required')
  }

  try {
    const decoded = authService.verifyAccessToken(accessToken)
    return { userId: decoded.userId }
  } catch (error) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired access token')
  }
}
