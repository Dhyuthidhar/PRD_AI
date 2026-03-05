import { NextRequest, NextResponse } from 'next/server'
import { qwen3Service, ChatMessage } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const { conversationId, message } = await request.json()

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'Missing conversation ID or message' }, { status: 400 })
    }

    // Get conversation history
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', decoded.userId)
      .single()

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Build message history for AI context
    const messages: ChatMessage[] = conversation.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }))

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    })

    // Generate AI response
    const response = await qwen3Service.generateResponse(messages, {
      max_tokens: 2000,
      temperature: 0.7
    })

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
