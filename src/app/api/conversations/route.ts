import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'

export async function GET(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations'
  
  try {
    const { userId } = getAuthUser(request)
    
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_modified', { ascending: false })

    if (error) {
      throw error
    }

    Logger.info('Conversations fetched', {
      requestId,
      route,
      userId,
      count: data?.length || 0,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ conversations: data || [] })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to fetch conversations', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations'
  
  try {
    const { userId } = getAuthUser(request)
    const { project_name } = validateBody(schemas.conversation.create, await parseJson(request))

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

    Logger.info('Conversation created', {
      requestId,
      route,
      userId,
      conversationId: data.id,
      projectName: data.project_name,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ conversation: data }, { status: 201 })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to create conversation', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
