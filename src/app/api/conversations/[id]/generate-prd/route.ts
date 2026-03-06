import { NextRequest, NextResponse } from 'next/server'
import { qwen3Service } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { createRequestId, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { schemas } from '@/lib/api/validate'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/[id]/generate-prd'
  
  try {
    // Rate limiting: 10 requests per hour per userId+IP
    enforceRateLimit(request, { limit: 10, windowMs: 60 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    const { id: conversationId } = await params
    
    // Validate conversation ID format
    schemas.uuid.parse(conversationId)

    // Get conversation
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !conversation) {
      throw new Error('Conversation not found')
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
        Logger.error(`Failed to extract ${section}`, error, { requestId, route, conversationId })
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

    Logger.info('PRD generated successfully', {
      requestId,
      route,
      userId,
      conversationId,
      prdLength: prd.length,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ 
      prd,
      conversation: updatedConversation 
    })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to generate PRD', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
