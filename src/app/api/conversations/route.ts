import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const decoded = authService.verifyToken(token)
    const userId = decoded.userId

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_modified', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ conversations: data || [] })
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const decoded = authService.verifyToken(token)
    const userId = decoded.userId
    const { project_name } = await request.json()

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: userId,
        project_name: project_name || 'Untitled Project',
        status: 'in_progress',
        messages: []
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ conversation: data }, { status: 201 })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
