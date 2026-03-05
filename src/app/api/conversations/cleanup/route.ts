import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const decoded = authService.verifyToken(token)
    const userId = decoded.userId

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

    return NextResponse.json({ 
      message: `Cleaned up ${data?.length || 0} duplicate conversations`,
      deleted: data || []
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup conversations' },
      { status: 500 }
    )
  }
}
