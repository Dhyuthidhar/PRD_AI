import { ConversationStage, STAGE_CONFIG } from './conversationStages'
import { Message } from '@/types'

export interface StageAdvanceResult {
  newStage: ConversationStage
  advanced: boolean
  reason: string
}

// Count user messages in conversation excluding the initial assistant greeting
function countUserResponses(messages: Message[]): number {
  return messages.filter(m => m.role === 'user').length
}

// Count user responses since a given stage started
// Stage starts after the first assistant message following stage entry
function countUserResponsesInCurrentStage(
  messages: Message[],
  currentStage: ConversationStage
): number {
  // For simplicity and reliability: count total user messages
  // divided proportionally. We track this properly via stage_data instead.
  return messages.filter(m => m.role === 'user').length
}

export function shouldAdvanceStage(
  currentStage: ConversationStage,
  messages: Message[],
  stageData: Record<string, number>
): StageAdvanceResult {
  // Never advance past GENERATE
  if (currentStage === ConversationStage.GENERATE) {
    return { newStage: currentStage, advanced: false, reason: 'Already at final stage' }
  }

  const stageKey = `stage_${currentStage}_user_responses` 
  const responsesInStage = stageData[stageKey] || 0
  const required = STAGE_CONFIG[currentStage].minUserResponses

  if (responsesInStage >= required) {
    const nextStage = (currentStage + 1) as ConversationStage
    return {
      newStage: nextStage,
      advanced: true,
      reason: `Stage ${currentStage} complete: ${responsesInStage}/${required} responses collected`,
    }
  }

  return {
    newStage: currentStage,
    advanced: false,
    reason: `Stage ${currentStage} needs ${required - responsesInStage} more response(s)`,
  }
}

export function incrementStageResponseCount(
  stageData: Record<string, number>,
  currentStage: ConversationStage
): Record<string, number> {
  const stageKey = `stage_${currentStage}_user_responses` 
  return {
    ...stageData,
    [stageKey]: (stageData[stageKey] || 0) + 1,
  }
}

export function isReadyForPRD(currentStage: ConversationStage): boolean {
  return currentStage === ConversationStage.GENERATE
}

export function getBlockedMessage(currentStage: ConversationStage): string {
  const stagesRemaining = []
  
  const stageNames: Record<number, string> = {
    [ConversationStage.ASSESS]: 'Initial Assessment',
    [ConversationStage.OVERVIEW]: 'Project Overview',
    [ConversationStage.USERS]: 'User Roles',
    [ConversationStage.FEATURES]: 'Features & Workflows',
    [ConversationStage.TECHNICAL]: 'Technical Requirements',
    [ConversationStage.UXUI]: 'UI/UX Requirements',
    [ConversationStage.CONFIRM]: 'Final Confirmation',
  }

  for (let s = currentStage; s < ConversationStage.GENERATE; s++) {
    stagesRemaining.push(stageNames[s])
  }

  return `I need a bit more information before I can generate your PRD. We still need to cover: ${stagesRemaining.join(', ')}. Let's keep going — I'll let you know when we're ready.` 
}
