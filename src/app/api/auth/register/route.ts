import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, role } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const user = await authService.createUser({
      email,
      password,
      name,
      role: role || 'user'
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error: any) {
    console.error('Registration error:', error)
    
    if (error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
