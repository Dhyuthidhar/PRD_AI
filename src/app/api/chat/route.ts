import { NextRequest, NextResponse } from 'next/server'
import { qwen3Service, ChatMessage } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { InputSanitizer } from '@/lib/inputSanitizer'
import { detectPRDRequest, getStageSystemPrompt, getStageLabel, ConversationStage } from '@/lib/conversationStages'
import { shouldAdvanceStage, incrementStageResponseCount, getBlockedMessage } from '@/lib/stageManager'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/chat'
  
  try {
    // Rate limiting: 30 requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 30, windowMs: 10 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    const { conversationId, message } = validateBody(schemas.chat, await parseJson(request))

    // Validate and sanitize input
    const validation = InputSanitizer.validateMessage(message)
    if (!validation.isValid) {
      throw new Error(validation.reason)
    }
    
    const sanitizedMessage = InputSanitizer.sanitizeText(message)

    // 1. Fetch conversation from DB — get current_stage and stage_data fields too
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('id, messages, current_stage, stage_data, project_name, status, generated_prd')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !conversation) {
      throw new Error('Conversation not found')
    }

    const currentStage = conversation.current_stage as ConversationStage
    const stageData = conversation.stage_data as Record<string, number>

    // Handle __INIT__ trigger for new conversations
    if (sanitizedMessage === '__INIT__') {
      // Use stage 0 system prompt without incrementing stage_data or advancing
      const systemPrompt = getStageSystemPrompt(ConversationStage.ASSESS)
      
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Start the conversation' }
      ]

      const response = await qwen3Service.generateResponse(messages, {
        max_tokens: 2000,
        temperature: 0.7
      })

      // Guard against empty response
      if (!response || response.trim() === '') {
        return NextResponse.json(
          { 
            error: 'AI service returned an empty response. Please try again.',
            currentStage: 0,
            stageName: getStageLabel(0),
            stageProgress: 0
          },
          { status: 503 }
        )
      }

      const responseData = NextResponse.json({ 
        response,
        currentStage: 0,
        stageName: getStageLabel(0),
        stageProgress: 0
      })
      return addRequestIdHeader(responseData, requestId)
    }

    // 2. Check if message is a PRD generation request using detectPRDRequest()
    if (detectPRDRequest(sanitizedMessage) && currentStage < ConversationStage.GENERATE) {
      const blockedMessage = getBlockedMessage(currentStage)
      
      // Save user message and blocked response
      const updatedMessages = [
        ...conversation.messages,
        {
          id: Date.now().toString(),
          role: 'user' as const,
          content: sanitizedMessage,
          timestamp: new Date().toISOString()
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: blockedMessage,
          timestamp: new Date().toISOString()
        }
      ]

      // Update conversation with messages
      await supabaseAdmin
        .from('conversations')
        .update({
          messages: updatedMessages,
          last_modified: new Date().toISOString()
        })
        .eq('id', conversationId)

      const responseData = NextResponse.json({ 
        response: blockedMessage,
        currentStage,
        stageName: getStageLabel(currentStage),
        stageProgress: Math.round((currentStage / 7) * 100)
      })
      return addRequestIdHeader(responseData, requestId)
    }

    // 3. Increment stage response count for current stage
    const updatedStageData = incrementStageResponseCount(stageData, currentStage)

    // 4. Check if stage should advance
    const advanceResult = shouldAdvanceStage(currentStage, conversation.messages, updatedStageData)
    const newStage = advanceResult.advanced ? advanceResult.newStage : currentStage

    // 5. Get system prompt for the NEW stage (after potential advancement)
    const systemPrompt = getStageSystemPrompt(newStage)

    // 6. Build message array for HuggingFace
    const recentMessages = conversation.messages
      .slice(-6) // Last 6 messages from history
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages,
      { role: 'user', content: sanitizedMessage }
    ]

    // 7. Call HuggingFace with this message array
    const response = await qwen3Service.generateResponse(messages, {
      max_tokens: 2000,
      temperature: 0.7
    })

    // Guard against empty response
    if (!response || response.trim() === '') {
      return NextResponse.json(
        { 
          error: 'AI service returned an empty response. Please try again.',
          currentStage: currentStage,  // Return ORIGINAL stage, not newStage
          stageName: getStageLabel(currentStage),
          stageProgress: Math.round((currentStage / 7) * 100)
        },
        { status: 503 }
      )
    }

    // 8. Save to DB in ONE update call
    const finalMessages = [
      ...conversation.messages,
      {
        id: Date.now().toString(),
        role: 'user' as const,
        content: sanitizedMessage,
        timestamp: new Date().toISOString()
      },
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString()
      }
    ]

    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        messages: finalMessages,
        current_stage: newStage,
        stage_data: updatedStageData,
        last_modified: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId)

    if (updateError) {
      // Log the error with full context for debugging
      console.error('[chat] DB update failed after AI response', {
        conversationId,
        userId,
        newStage,
        error: updateError.message,
      })
      // Return the AI response to user BUT signal stage save failed
      // Frontend can still show the AI message — better than silent failure
      return NextResponse.json({
        response: response,
        currentStage: currentStage,   // Return ORIGINAL stage — not advanced
        stageName: getStageLabel(currentStage),
        stageProgress: Math.round((currentStage / 7) * 100),
        warning: 'Response received but progress may not have saved. If issues persist, refresh the page.'
      })
    }

    Logger.info('Chat response generated', {
      requestId,
      route,
      userId,
      conversationId,
      messageLength: message.length,
      responseLength: response.length,
      durationMs: Date.now() - startTime,
      currentStage: newStage,
      stageAdvanced: advanceResult.advanced
    })

    // 9. Return response
    const responseData = NextResponse.json({ 
      response,
      currentStage: newStage,
      stageName: getStageLabel(newStage),
      stageProgress: Math.round((newStage / 7) * 100)
    })
    return addRequestIdHeader(responseData, requestId)
    
  } catch (error) {
    Logger.error('Failed to generate chat response', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
