import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function DELETE(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/cleanup'
  
  try {
    // Rate limiting: 10 requests per hour per userId
    enforceRateLimit(request, { limit: 10, windowMs: 60 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)

    // Delete all conversations that have no messages and are "in_progress"
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .is('messages', '[]')
      .select('id')

    if (error) {
      throw error
    }

    Logger.info('Conversations cleaned up successfully', {
      requestId,
      route,
      userId,
      deletedCount: data?.length || 0,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ 
      message: `Cleaned up ${data?.length || 0} duplicate conversations`,
      deleted: data || []
    })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to cleanup conversations', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
