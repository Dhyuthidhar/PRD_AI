import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/auth'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const route = '/api/auth/logout'
  
  try {
    const refreshToken = request.cookies.get('refresh-token')?.value
    
    if (refreshToken) {
      // Revoke refresh token
      try {
        const decoded = authService.verifyRefreshToken(refreshToken)
        await authService.revokeRefreshToken(decoded.tokenId)
      } catch (error) {
        // Token might be invalid, but continue with logout
        Logger.error('Invalid refresh token during logout', error, { requestId, route })
      }
    }
    
    Logger.info('Logout successful', { requestId, route })
    
    const response = NextResponse.json({ message: 'Logged out successfully' })
    
    // Clear both cookies
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
    
  } catch (error) {
    Logger.error('Logout failed', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
