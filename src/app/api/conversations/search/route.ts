import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { createRequestId, readQueryParam, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { z } from 'zod'

// Search validation schema
const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
  status: z.enum(['in_progress', 'completed']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
})

export async function GET(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/search'
  
  try {
    // Rate limiting: 60 requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 60, windowMs: 10 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    
    // Parse and validate query parameters
    const query = readQueryParam(request, 'q')
    const status = readQueryParam(request, 'status')
    const dateFrom = readQueryParam(request, 'dateFrom')
    const dateTo = readQueryParam(request, 'dateTo')
    
    if (!query) {
      throw new Error('Search query is required')
    }

    // Validate search parameters
    searchSchema.parse({ q: query, status, dateFrom, dateTo })

    // Build search query
    let dbQuery = supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', userId)

    // Text search in project_name and messages (sanitized)
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
    dbQuery = dbQuery.or(`project_name.ilike.%${sanitizedQuery}%,messages::text.ilike.%${sanitizedQuery}%`)

    // Filter by status if provided
    if (status && ['in_progress', 'completed'].includes(status)) {
      dbQuery = dbQuery.eq('status', status)
    }

    // Filter by date range if provided
    if (dateFrom) {
      dbQuery = dbQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('created_at', dateTo)
    }

    const { data: conversations, error } = await dbQuery
      .order('last_modified', { ascending: false })

    if (error) {
      throw error
    }

    Logger.info('Conversations searched successfully', {
      requestId,
      route,
      userId,
      query: sanitizedQuery,
      status,
      resultCount: conversations?.length || 0,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ conversations: conversations || [] })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to search conversations', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
