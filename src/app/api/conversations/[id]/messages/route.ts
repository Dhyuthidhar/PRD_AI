import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const { id: conversationId } = await params
    const messageData = await request.json()

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

    // Add message to conversation
    const updatedMessages = [...conversation.messages, {
      id: Date.now().toString(),
      ...messageData,
      timestamp: new Date().toISOString()
    }]

    // Update conversation
    const { data: updatedConversation, error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        messages: updatedMessages,
        last_modified: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ message: 'Message added successfully' })
  } catch (error) {
    console.error('Add message error:', error)
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    )
  }
}
