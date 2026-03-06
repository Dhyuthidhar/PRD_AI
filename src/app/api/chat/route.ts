import { NextRequest, NextResponse } from 'next/server'
import { qwen3Service, ChatMessage } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/chat'
  
  try {
    // Rate limiting: 30 requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 30, windowMs: 10 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    const { conversationId, message } = validateBody(schemas.chat, await parseJson(request))

    // Get conversation history
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !conversation) {
      throw new Error('Conversation not found')
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

    Logger.info('Chat response generated', {
      requestId,
      route,
      userId,
      conversationId,
      messageLength: message.length,
      responseLength: response.length,
      durationMs: Date.now() - startTime
    })

    const responseData = NextResponse.json({ response })
    return addRequestIdHeader(responseData, requestId)
    
  } catch (error) {
    Logger.error('Failed to generate chat response', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
