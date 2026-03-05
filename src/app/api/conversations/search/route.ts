import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    // Build search query
    let dbQuery = supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', decoded.userId)

    // Text search in project_name and messages
    dbQuery = dbQuery.or(`project_name.ilike.%${query}%,messages::text.ilike.%${query}%`)

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

    return NextResponse.json({ conversations: conversations || [] })
  } catch (error) {
    console.error('Search conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to search conversations' },
      { status: 500 }
    )
  }
}
