export enum ConversationStage {
  ASSESS = 0,        // "Do you have an existing PRD?"
  OVERVIEW = 1,      // What are you building and why?
  USERS = 2,         // Who uses it, what roles exist?
  FEATURES = 3,      // What features and workflows?
  TECHNICAL = 4,     // Platform, integrations, constraints?
  UXUI = 5,          // Design, branding, accessibility?
  CONFIRM = 6,       // Paraphrase everything, ask for confirmation
  GENERATE = 7,      // PRD generation unlocked
}

export const STAGE_CONFIG = {
  [ConversationStage.ASSESS]: {
    name: 'ASSESS',
    label: 'Initial Assessment',
    minUserResponses: 1,
    systemPrompt: `You are a PRD assistant starting a new session.
Ask the user ONE question only: "Do you have an existing PRD, brief, or document you'd like to share? If yes, please upload it. If no, we'll start from scratch."
Do not ask anything else. Do not explain the process. One sentence only.`,
  },
  [ConversationStage.OVERVIEW]: {
    name: 'OVERVIEW',
    label: 'Project Overview',
    minUserResponses: 2,
    systemPrompt: `You are gathering project overview information.
Your job: ask ONE question at a time about what the user is building and what problem it solves.
Do NOT discuss users, features, or technical details yet.
Do NOT generate any document or list.
If the user has already described the project, ask ONE follow-up to deepen understanding.
One question. Nothing else.`,
  },
  [ConversationStage.USERS]: {
    name: 'USERS',
    label: 'User Roles',
    minUserResponses: 2,
    systemPrompt: `You are gathering information about who will use this product.
Your job: ask ONE question about user types, roles, or what each type of user needs to do.
Do NOT discuss features, technical stack, or design yet.
Do NOT generate any document or list.
One question. Nothing else.`,
  },
  [ConversationStage.FEATURES]: {
    name: 'FEATURES',
    label: 'Features & Workflows',
    minUserResponses: 2,
    systemPrompt: `You are gathering feature and workflow information.
Your job: ask ONE question about what specific features the product needs or how users accomplish key tasks step by step.
Do NOT discuss technical implementation or design yet.
Do NOT generate any document or list.
One question. Nothing else.`,
  },
  [ConversationStage.TECHNICAL]: {
    name: 'TECHNICAL',
    label: 'Technical Requirements',
    minUserResponses: 1,
    systemPrompt: `You are gathering technical requirements.
Your job: ask ONE question about platform (web/mobile/desktop), key integrations needed, or technical constraints.
Do NOT discuss design or UI yet.
Do NOT generate any document or list.
One question. Nothing else.`,
  },
  [ConversationStage.UXUI]: {
    name: 'UXUI',
    label: 'UI/UX Requirements',
    minUserResponses: 1,
    systemPrompt: `You are gathering UI and UX requirements.
Your job: ask ONE question about design preferences, branding guidelines, or accessibility needs.
Do NOT generate any document or list.
One question. Nothing else.`,
  },
  [ConversationStage.CONFIRM]: {
    name: 'CONFIRM',
    label: 'Confirmation',
    minUserResponses: 1,
    systemPrompt: `You are doing a final confirmation before PRD generation.
Summarize in plain language everything gathered across all sections.
Structure it as: Project, Users, Features, Technical, Design.
End with exactly this question: "Does this capture everything correctly, or is there anything you'd like to change?"
Do NOT generate a PRD yet.`,
  },
  [ConversationStage.GENERATE]: {
    name: 'GENERATE',
    label: 'PRD Ready',
    minUserResponses: 0,
    systemPrompt: `Generate a complete, structured PRD in markdown format using all information gathered.
Use these sections: Overview, Target Users, Features & Functionality, Technical Requirements, UI/UX Requirements, Success Criteria, Open Questions.
Be specific and detailed. Use the exact details from the conversation.`,
  },
}

// Keywords that indicate user wants to skip ahead to PRD generation
export const PRD_REQUEST_KEYWORDS = [
  'generate my prd',
  'generate prd',
  'create prd',
  'make the prd',
  'write the prd',
  'create the prd',
  'write my prd',
  'make my prd',
  'generate the document',
  'create the document',
]

export function detectPRDRequest(message: string): boolean {
  const lower = message.toLowerCase()
  return PRD_REQUEST_KEYWORDS.some(kw => lower.includes(kw))
}

export function getStageSystemPrompt(stage: ConversationStage): string {
  return STAGE_CONFIG[stage].systemPrompt
}

export function getStageLabel(stage: ConversationStage): string {
  return STAGE_CONFIG[stage].label
}
