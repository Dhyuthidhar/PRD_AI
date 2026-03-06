import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/[id]'
  
  try {
    const { userId } = getAuthUser(request)
    const { id: conversationId } = await params
    
    // Validate conversation ID format
    schemas.uuid.parse(conversationId)

    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !conversation) {
      throw new Error('Conversation not found')
    }

    Logger.info('Conversation fetched', {
      requestId,
      route,
      userId,
      conversationId,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ conversation })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to fetch conversation', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/[id]'
  
  try {
    const { userId } = getAuthUser(request)
    const { id: conversationId } = await params
    const updates = validateBody(schemas.conversation.update, await parseJson(request))
    
    // Validate conversation ID format
    schemas.uuid.parse(conversationId)

    // Verify conversation belongs to user
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !conversation) {
      throw new Error('Conversation not found')
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

    Logger.info('Conversation updated', {
      requestId,
      route,
      userId,
      conversationId,
      updates: Object.keys(updates),
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ conversation: updatedConversation })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to update conversation', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
