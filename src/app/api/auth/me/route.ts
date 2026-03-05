import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    const decoded = authService.verifyToken(token)
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', decoded.userId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Auth verification error:', error)
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }
}
