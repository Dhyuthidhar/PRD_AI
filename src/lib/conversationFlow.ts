import { ChatMessage } from './huggingface'

export interface ConversationSection {
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  prompts: string[]
  clarifications: string[]
}

export interface ConversationState {
  currentSection: number
  sections: ConversationSection[]
  collectedInfo: Record<string, string>
}

export class ConversationFlowManager {
  private sections: ConversationSection[] = [
    {
      name: 'overview',
      status: 'pending',
      prompts: [
        "Let's start with the project overview. What are you building?",
        "Can you describe what this system does at a high level?",
        "What problem does this project solve?"
      ],
      clarifications: [
        "You mentioned 'system' - is this a web application, mobile app, or something else?",
        "What's the main purpose of this project?",
        "Who is the target audience for this?"
      ]
    },
    {
      name: 'target_users',
      status: 'pending',
      prompts: [
        "Now let's discuss the users. Who will be using this system?",
        "Are there different types of users with different roles?",
        "What can each type of user do?"
      ],
      clarifications: [
        "You mentioned 'users' - are these internal staff, external customers, or both?",
        "What permissions or access levels will different users have?",
        "Are there any admin users or special roles?"
      ]
    },
    {
      name: 'features',
      status: 'pending',
      prompts: [
        "Let's talk about the specific features needed. What functionality should this system have?",
        "How do users accomplish their main tasks? Walk me through the key workflows.",
        "What actions can users take within the system?"
      ],
      clarifications: [
        "You mentioned 'features' - are there any must-have vs nice-to-have features?",
        "What's the most important feature that users need?",
        "Are there any integrations with other systems required?"
      ]
    },
    {
      name: 'technical_requirements',
      status: 'pending',
      prompts: [
        "Let's discuss technical requirements. What platform(s) should this run on?",
        "Are there any specific integrations or APIs needed?",
        "What are the performance requirements?",
        "Any specific data storage or security requirements?"
      ],
      clarifications: [
        "You mentioned 'platform' - should this be web-based, mobile, desktop, or all of the above?",
        "Are there any existing systems this needs to integrate with?",
        "What kind of data will be stored and how sensitive is it?"
      ]
    },
    {
      name: 'ui_ux_requirements',
      status: 'pending',
      prompts: [
        "Finally, let's cover UI/UX requirements. Are there any specific design requirements?",
        "Are there branding guidelines or visual styles to follow?",
        "Any accessibility requirements or specific user experience considerations?"
      ],
      clarifications: [
        "You mentioned 'design' - is there an existing brand style guide?",
        "Are there any specific accessibility standards (WCAG) to meet?",
        "What devices or screen sizes need to be supported?"
      ]
    }
  ]

  getInitialState(): ConversationState {
    return {
      currentSection: 0,
      sections: this.sections.map(section => ({ ...section })),
      collectedInfo: {}
    }
  }

  getCurrentSection(state: ConversationState): ConversationSection | null {
    return state.sections[state.currentSection] || null
  }

  getNextPrompt(state: ConversationState, context: string): string {
    const currentSection = this.getCurrentSection(state)
    if (!currentSection) return ''

    // Check if we should ask clarifying questions
    if (this.needsClarification(context, currentSection)) {
      return this.getClarificationQuestion(context, currentSection)
    }

    // Get next prompt for current section
    const promptIndex = this.getProgressInSection(context, currentSection)
    if (promptIndex < currentSection.prompts.length) {
      return currentSection.prompts[promptIndex]
    }

    // Section complete, move to next
    return this.moveToNextSection(state)
  }

  private needsClarification(context: string, section: ConversationSection): boolean {
    // Simple heuristic: if context is very short or contains vague terms
    const vagueTerms = ['system', 'application', 'platform', 'users', 'features', 'design']
    const hasVagueTerms = vagueTerms.some(term => 
      context.toLowerCase().includes(term) && context.length < 100
    )
    
    return hasVagueTerms && Math.random() > 0.5 // 50% chance to ask for clarification
  }

  private getClarificationQuestion(context: string, section: ConversationSection): string {
    const availableQuestions = section.clarifications.filter(q => 
      !context.toLowerCase().includes(q.toLowerCase().substring(0, 20))
    )
    
    if (availableQuestions.length > 0) {
      return availableQuestions[Math.floor(Math.random() * availableQuestions.length)]
    }
    
    return "Could you provide more specific details about that?"
  }

  private getProgressInSection(context: string, section: ConversationSection): number {
    // Simple heuristic based on context length and content
    const contextWords = context.split(' ').length
    if (contextWords < 20) return 0
    if (contextWords < 50) return 1
    return section.prompts.length // Section complete
  }

  private moveToNextSection(state: ConversationState): string {
    const nextIndex = state.currentSection + 1
    if (nextIndex >= state.sections.length) {
      return "Great! I have all the information I need. Would you like me to generate the PRD now?"
    }

    state.currentSection = nextIndex
    state.sections[nextIndex].status = 'in_progress'
    
    const nextSection = state.sections[nextIndex]
    return `Perfect! Now let's discuss ${nextSection.name}. ${nextSection.prompts[0]}`
  }

  processUserResponse(state: ConversationState, response: string): ConversationState {
    const currentSection = this.getCurrentSection(state)
    if (!currentSection) return state

    // Add response to collected info
    if (!state.collectedInfo[currentSection.name]) {
      state.collectedInfo[currentSection.name] = ''
    }
    state.collectedInfo[currentSection.name] += response + '\n'

    // Update section status based on progress
    const progress = this.getProgressInSection(state.collectedInfo[currentSection.name], currentSection)
    if (progress >= currentSection.prompts.length) {
      currentSection.status = 'completed'
    }

    return { ...state }
  }

  generateParaphrasing(state: ConversationState): string {
    const currentSection = this.getCurrentSection(state)
    if (!currentSection) return ''

    const info = state.collectedInfo[currentSection.name]
    if (!info) return ''

    return `Let me make sure I understand the ${currentSection.name}: ${info.substring(0, 200)}... Does that capture what you mean?`
  }

  detectGaps(state: ConversationState): string[] {
    const gaps: string[] = []
    
    // Check for missing sections
    state.sections.forEach(section => {
      if (section.status === 'pending') {
        gaps.push(`We haven't discussed ${section.name} yet`)
      }
    })

    // Check for incomplete information
    Object.entries(state.collectedInfo).forEach(([section, info]) => {
      if (info.split(' ').length < 20) {
        gaps.push(`The ${section} section seems incomplete`)
      }
    })

    return gaps
  }

  isConversationComplete(state: ConversationState): boolean {
    return state.sections.every(section => section.status === 'completed')
  }
}

export const conversationFlowManager = new ConversationFlowManager()
