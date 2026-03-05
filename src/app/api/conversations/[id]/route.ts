import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const { id: conversationId } = await params

    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', decoded.userId)
      .single()

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Get conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const { id: conversationId } = await params
    const updates = await request.json()

    // Verify conversation belongs to user
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', decoded.userId)
      .single()

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: updatedConversation, error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        ...updates,
        last_modified: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ conversation: updatedConversation })
  } catch (error) {
    console.error('Update conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}
