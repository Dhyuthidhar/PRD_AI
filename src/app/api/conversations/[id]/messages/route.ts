import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/[id]/messages'
  
  try {
    const { id: conversationId } = await params
    const { userId } = getAuthUser(request)
    const messageData = validateBody(schemas.conversation.message, await parseJson(request))
    
    // Validate conversation ID format
    schemas.uuid.parse(conversationId)
    
    // Create message with UUID and timestamp
    const messageWithMeta = {
      id: crypto.randomUUID(),
      ...messageData,
      timestamp: new Date().toISOString()
    }
    
    // Use atomic RPC function to prevent race conditions
    const { data, error } = await supabaseAdmin.rpc('append_conversation_message', {
      p_conversation_id: conversationId,
      p_user_id: userId,
      p_message: messageWithMeta
    })
    
    if (error) {
      if (error.message?.includes('not found or access denied')) {
        throw new Error('Conversation not found')
      }
      throw error
    }
    
    Logger.info('Message added successfully', {
      requestId,
      route,
      userId,
      conversationId,
      messageId: messageWithMeta.id,
      durationMs: Date.now() - startTime
    })
    
    const response = NextResponse.json({ 
      message: 'Message added successfully',
      messageId: messageWithMeta.id
    })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to add message', error, {
      requestId,
      route,
      userId: getAuthUser(request).userId
    })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
