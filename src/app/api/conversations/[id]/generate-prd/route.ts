import { NextRequest, NextResponse } from 'next/server'
import { qwen3Service } from '@/lib/huggingface'
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

    // Get conversation
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', decoded.userId)
      .single()

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Extract conversation content for PRD generation
    const conversationText = conversation.messages
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n\n')

    // Generate sections based on conversation
    const sections: Record<string, string> = {
      overview: '',
      target_users: '',
      features: '',
      technical_requirements: '',
      ui_ux_requirements: ''
    }

    // Extract information for each section
    for (const [section, prompt] of Object.entries({
      overview: 'Extract the project overview and high-level description',
      target_users: 'Extract information about target users and their roles',
      features: 'Extract detailed features and functionality requirements',
      technical_requirements: 'Extract technical specifications, platforms, and integration requirements',
      ui_ux_requirements: 'Extract UI/UX requirements, design guidelines, and accessibility needs'
    })) {
      try {
        const response = await qwen3Service.generateResponse([
          {
            role: 'user',
            content: `Based on the following conversation, ${prompt}:\n\n${conversationText}\n\nProvide a comprehensive summary for this section.`
          }
        ], { max_tokens: 1000 })
        
        sections[section] = response
      } catch (error) {
        console.error(`Failed to extract ${section}:`, error)
        sections[section] = `Information about ${section.replace('_', ' ')} not found in conversation.`
      }
    }

    // Generate final PRD
    const prd = await qwen3Service.generatePRD(sections)

    // Update conversation with generated PRD
    const { data: updatedConversation, error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        generated_prd: prd,
        status: 'completed',
        last_modified: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ 
      prd,
      conversation: updatedConversation 
    })
  } catch (error) {
    console.error('PRD generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PRD' },
      { status: 500 }
    )
  }
}
