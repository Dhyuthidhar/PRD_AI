import { ChatMessage } from './huggingface'
import { conversationFlowManager, ConversationState } from './conversationFlow'
import { ConversationStateService } from './conversationState'

export interface PromptBuilderContext {
  conversation: {
    id: string
    messages: Array<{ role: string; content: string; timestamp: string }>
    generated_prd?: string
  }
  currentMessage: string
  documentContext?: DocumentContext[]
  flowState?: ConversationState
}

export interface DocumentContext {
  filename: string
  analysis: string
  pageCount?: number
  timestamp: string
}

export class PromptBuilder {
  private static readonly SYSTEM_PROMPT = `You are an expert Product Requirements Document (PRD) Assistant. Your role is to help users create comprehensive, well-structured PRDs through guided conversation.

RESPONSIBILITIES:
1. Gather requirements systematically using a structured approach
2. Ask clarifying questions when information is incomplete or vague
3. Analyze uploaded documents and extract key insights
4. Guide users through all essential PRD sections
5. Maintain professional, business-focused communication
6. Avoid generic answers - be specific and actionable

CONVERSATION APPROACH:
- Start with project overview and business goals
- Progress through target users, features, technical requirements, and UI/UX
- Ask follow-up questions to fill gaps
- Reference uploaded documents when relevant
- Keep responses concise but informative
- Focus on business value and user needs

RESPONSE GUIDELINES:
- Be conversational but professional
- Ask one focused question at a time
- Reference previous context when relevant
- Suggest next steps when appropriate
- Avoid template-like responses`

  private static readonly MAX_HISTORY_MESSAGES = 10
  private static readonly CONTEXT_SUMMARY_LIMIT = 800

  static buildChatPrompt(context: PromptBuilderContext): ChatMessage[] {
    const messages: ChatMessage[] = []

    // 1. System prompt
    messages.push({
      role: 'system',
      content: this.SYSTEM_PROMPT
    })

    // 2. Stage and context prompt
    const stagePrompt = this.buildStagePrompt(context)
    if (stagePrompt) {
      messages.push({
        role: 'user',
        content: stagePrompt
      })
    }

    // 3. Document context (summarized)
    const docContext = this.buildDocumentContext(context.documentContext)
    if (docContext) {
      messages.push({
        role: 'user',
        content: docContext
      })
    }

    // 4. Recent conversation history
    const historyMessages = this.buildHistoryMessages(context.conversation.messages)
    messages.push(...historyMessages)

    // 5. Current user message
    messages.push({
      role: 'user',
      content: context.currentMessage
    })

    return messages
  }

  private static buildStagePrompt(context: PromptBuilderContext): string {
    const flowState = context.flowState || conversationFlowManager.getInitialState()
    const currentSection = conversationFlowManager.getCurrentSection(flowState)
    
    if (!currentSection) {
      return `CURRENT STAGE: Requirements gathering complete. Ready for PRD generation.

CONTEXT SUMMARY:
${this.summarizeConversation(context.conversation.messages)}

Focus on refining requirements and preparing for PRD generation.`
    }

    // Use improved gap detection from ConversationStateService
    const missingSections = ConversationStateService.getMissingSections(flowState)
    const nextFocus = ConversationStateService.getNextRecommendedFocus(flowState)
    const progress = ConversationStateService.getProgressPercentage(flowState)
    
    const gapsText = missingSections.length > 0 ? `\nMISSING INFORMATION:\n- ${missingSections.join('\n- ')}` : ''
    const progressText = `PROGRESS: ${Math.round(progress)}% complete`

    return `CURRENT STAGE: Gathering ${currentSection.name.replace('_', ' ').toUpperCase()} requirements

${progressText}
SECTION STATUS: ${currentSection.status}
${gapsText}

NEXT FOCUS: ${nextFocus}

Ask specific questions to complete this section before moving to the next stage.`
  }

  private static buildDocumentContext(documentContext?: DocumentContext[]): string {
    if (!documentContext || documentContext.length === 0) {
      return ''
    }

    const summaries = documentContext.map(doc => {
      const truncatedAnalysis = doc.analysis.length > this.CONTEXT_SUMMARY_LIMIT 
        ? doc.analysis.substring(0, this.CONTEXT_SUMMARY_LIMIT) + '...'
        : doc.analysis

      return `DOCUMENT: ${doc.filename}
${truncatedAnalysis}`
    }).join('\n\n')

    return `UPLOADED DOCUMENTS CONTEXT:
${summaries}

Reference these documents when relevant to requirements gathering. Use the insights to inform your questions and suggestions.`
  }

  private static buildHistoryMessages(messages: Array<{ role: string; content: string }>): ChatMessage[] {
    // Get recent messages, excluding the very last one (current message)
    const recentMessages = messages
      .slice(-this.MAX_HISTORY_MESSAGES - 1, -1)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

    return recentMessages
  }

  private static summarizeConversation(messages: Array<{ role: string; content: string }>): string {
    if (messages.length === 0) return 'No conversation history.'

    const keyPoints = messages
      .filter(msg => msg.role === 'user')
      .slice(-5) // Last 5 user messages
      .map(msg => {
        const firstSentence = msg.content.split('.')[0] + '.'
        return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence
      })
      .join('\n- ')

    return `KEY POINTS DISCUSSED:\n- ${keyPoints}`
  }

  static estimateTokens(messages: ChatMessage[]): number {
    // Rough estimation: ~1 token per 4 characters
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0)
    return Math.ceil(totalChars / 4)
  }

  static getPromptStats(context: PromptBuilderContext): {
    messageCount: number
    estimatedTokens: number
    hasSystemPrompt: boolean
    hasDocumentContext: boolean
    hasStageContext: boolean
    historyMessageCount: number
  } {
    const messages = this.buildChatPrompt(context)
    
    return {
      messageCount: messages.length,
      estimatedTokens: this.estimateTokens(messages),
      hasSystemPrompt: true,
      hasDocumentContext: !!context.documentContext && context.documentContext.length > 0,
      hasStageContext: !!context.flowState,
      historyMessageCount: Math.min(context.conversation.messages.length - 1, this.MAX_HISTORY_MESSAGES)
    }
  }
}