import { conversationFlowManager, ConversationState } from './conversationFlow'

export class ConversationStateService {
  static getStateFromMessages(messages: Array<{ role: string; content: string }>): ConversationState {
    const state = conversationFlowManager.getInitialState()
    
    // Analyze conversation content more intelligently
    const userMessages = messages.filter(msg => msg.role === 'user')
    const conversationText = userMessages.map(msg => msg.content.toLowerCase()).join(' ')
    
    // Calculate content coverage for each PRD section
    const coverage = this.calculateSectionCoverage(conversationText, userMessages)
    
    // Determine current stage based on coverage and conversation flow
    const currentStage = this.determineCurrentStage(coverage, userMessages.length)
    state.currentSection = currentStage
    
    // Update section statuses based on actual content analysis
    this.updateSectionStatuses(state, coverage, userMessages)

    return state
  }

  private static calculateSectionCoverage(conversationText: string, userMessages: Array<{ content: string }>): Record<string, number> {
    const coverage: Record<string, number> = {
      overview: 0,
      target_users: 0,
      features: 0,
      technical_requirements: 0,
      ui_ux_requirements: 0
    }

    // Overview indicators
    if (conversationText.includes('problem') || conversationText.includes('solve') || conversationText.includes('goal')) {
      coverage.overview += 30
    }
    if (conversationText.includes('purpose') || conversationText.includes('objective') || conversationText.includes('mission')) {
      coverage.overview += 20
    }
    if (conversationText.includes('different') || conversationText.includes('unique') || conversationText.includes('competitive')) {
      coverage.overview += 20
    }

    // Target users indicators
    if (conversationText.includes('user') || conversationText.includes('audience') || conversationText.includes('customer')) {
      coverage.target_users += 30
    }
    if (conversationText.includes('persona') || conversationText.includes('demographic') || conversationText.includes('profile')) {
      coverage.target_users += 25
    }
    if (conversationText.includes('need') || conversationText.includes('pain point') || conversationText.includes('challenge')) {
      coverage.target_users += 20
    }

    // Features indicators
    if (conversationText.includes('feature') || conversationText.includes('function') || conversationText.includes('capability')) {
      coverage.features += 30
    }
    if (conversationText.includes('workflow') || conversationText.includes('process') || conversationText.includes('journey')) {
      coverage.features += 25
    }
    if (conversationText.includes('action') || conversationText.includes('task') || conversationText.includes('activity')) {
      coverage.features += 20
    }

    // Technical requirements indicators
    if (conversationText.includes('technical') || conversationText.includes('platform') || conversationText.includes('technology')) {
      coverage.technical_requirements += 30
    }
    if (conversationText.includes('integration') || conversationText.includes('api') || conversationText.includes('database')) {
      coverage.technical_requirements += 25
    }
    if (conversationText.includes('performance') || conversationText.includes('scalability') || conversationText.includes('security')) {
      coverage.technical_requirements += 20
    }

    // UI/UX requirements indicators
    if (conversationText.includes('ui') || conversationText.includes('ux') || conversationText.includes('interface')) {
      coverage.ui_ux_requirements += 30
    }
    if (conversationText.includes('design') || conversationText.includes('visual') || conversationText.includes('layout')) {
      coverage.ui_ux_requirements += 25
    }
    if (conversationText.includes('accessibility') || conversationText.includes('responsive') || conversationText.includes('mobile')) {
      coverage.ui_ux_requirements += 20
    }

    // Add content length bonuses
    userMessages.forEach(msg => {
      const contentLength = msg.content.length
      if (contentLength > 200) {
        // Distribute length bonus across likely sections based on keywords
        if (msg.content.toLowerCase().includes('user') || msg.content.toLowerCase().includes('audience')) {
          coverage.target_users += Math.min(20, contentLength / 50)
        }
        if (msg.content.toLowerCase().includes('feature') || msg.content.toLowerCase().includes('function')) {
          coverage.features += Math.min(20, contentLength / 50)
        }
        if (msg.content.toLowerCase().includes('technical') || msg.content.toLowerCase().includes('platform')) {
          coverage.technical_requirements += Math.min(20, contentLength / 50)
        }
      }
    })

    // Cap coverage at 100 for each section
    Object.keys(coverage).forEach(key => {
      coverage[key] = Math.min(100, coverage[key])
    })

    return coverage
  }

  private static determineCurrentStage(coverage: Record<string, number>, messageCount: number): number {
    // Find the least covered section that should come next
    const sections = ['overview', 'target_users', 'features', 'technical_requirements', 'ui_ux_requirements']
    
    // If overview is insufficient, stay there
    if (coverage.overview < 50) {
      return 0
    }
    
    // Find first incomplete section
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i]
      const prevSection = sections[i - 1]
      
      // Only move to next section if previous is reasonably covered
      if (coverage[prevSection] >= 40 && coverage[section] < 50) {
        return i
      }
    }
    
    // If all sections are well covered, move to completion
    const allWellCovered = sections.every(section => coverage[section] >= 60)
    return allWellCovered ? sections.length : Math.max(0, sections.length - 1)
  }

  private static updateSectionStatuses(state: ConversationState, coverage: Record<string, number>, userMessages: Array<{ content: string }>): void {
    const sections = ['overview', 'target_users', 'features', 'technical_requirements', 'ui_ux_requirements']
    
    sections.forEach((sectionName, index) => {
      const coverageScore = coverage[sectionName]
      
      if (coverageScore >= 70) {
        state.sections[index].status = 'completed'
      } else if (coverageScore >= 30) {
        state.sections[index].status = 'in_progress'
      } else {
        state.sections[index].status = 'pending'
      }
    })
  }

  static getCurrentStageName(state: ConversationState): string {
    const currentSection = conversationFlowManager.getCurrentSection(state)
    return currentSection ? currentSection.name : 'complete'
  }

  static getProgressPercentage(state: ConversationState): number {
    const completedSections = state.sections.filter(section => section.status === 'completed').length
    return (completedSections / state.sections.length) * 100
  }

  static shouldAskClarifyingQuestion(message: string, state: ConversationState): boolean {
    const vagueTerms = ['system', 'application', 'platform', 'users', 'features', 'design', 'thing', 'stuff']
    const hasVagueTerms = vagueTerms.some(term => 
      message.toLowerCase().includes(term) && message.length < 100
    )
    
    // Deterministic clarification based on content quality, not random
    const isShortVague = message.length < 80 && hasVagueTerms
    const isMissingKeyInfo = message.toLowerCase().split(' ').length < 10
    
    return isShortVague || isMissingKeyInfo
  }

  static getMissingSections(state: ConversationState): string[] {
    return state.sections
      .filter(section => section.status === 'pending')
      .map(section => section.name.replace('_', ' '))
  }

  static getNextRecommendedFocus(state: ConversationState): string {
    const currentSection = conversationFlowManager.getCurrentSection(state)
    if (!currentSection) {
      return 'PRD generation'
    }
    
    const gaps = this.getMissingSections(state)
    if (gaps.length > 0) {
      return gaps[0]
    }
    
    return currentSection.name.replace('_', ' ')
  }
}