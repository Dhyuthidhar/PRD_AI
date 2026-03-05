import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await authService.login({ email, password })

    const response = NextResponse.json({ user }, { status: 200 })
    
    response.cookies.set('auth-token', user.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    return response
  } catch (error: any) {
    console.error('Login error:', error)
    
    if (error.message === 'User not found' || error.message === 'Invalid credentials') {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
