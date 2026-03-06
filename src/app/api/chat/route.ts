import { NextRequest, NextResponse } from 'next/server'
import { qwen3Service, ChatMessage } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { PromptBuilder, PromptBuilderContext } from '@/lib/promptBuilder'
import { DocumentContextService } from '@/lib/documentContext'
import { ConversationStateService } from '@/lib/conversationState'

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

    // Get document context
    const documentContext = await DocumentContextService.getDocumentContext(conversationId)

    // Get conversation flow state
    const flowState = ConversationStateService.getStateFromMessages(conversation.messages)

    // Build enhanced prompt using PromptBuilder
    const promptContext: PromptBuilderContext = {
      conversation: {
        id: conversation.id,
        messages: conversation.messages,
        generated_prd: conversation.generated_prd
      },
      currentMessage: message,
      documentContext: documentContext,
      flowState: flowState
    }

    const messages = PromptBuilder.buildChatPrompt(promptContext)
    const promptStats = PromptBuilder.getPromptStats(promptContext)

    // Log request details
    Logger.info('Chat request built', {
      requestId,
      route,
      userId,
      conversationId,
      messageCount: promptStats.messageCount,
      estimatedTokens: promptStats.estimatedTokens,
      hasSystemPrompt: promptStats.hasSystemPrompt,
      hasDocumentContext: promptStats.hasDocumentContext,
      hasStageContext: promptStats.hasStageContext,
      historyMessageCount: promptStats.historyMessageCount,
      currentStage: ConversationStateService.getCurrentStageName(flowState),
      progressPercentage: ConversationStateService.getProgressPercentage(flowState)
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
      durationMs: Date.now() - startTime,
      tokensUsed: promptStats.estimatedTokens
    })

    const responseData = NextResponse.json({ response })
    return addRequestIdHeader(responseData, requestId)
    
  } catch (error) {
    Logger.error('Failed to generate chat response', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
