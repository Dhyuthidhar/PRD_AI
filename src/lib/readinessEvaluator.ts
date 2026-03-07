import { ConversationState } from './conversationFlow'

export interface ReadinessScore {
  overall: number // 0-100
  categories: {
    problem: number
    users: number
    workflow: number
    features: number
    business: number
    technical: number
  }
  missingCritical: string[]
  isReady: boolean
  nextFocus: string
}

export class ReadinessEvaluator {
  private static readonly CRITICAL_THRESHOLD = 70
  private static readonly MINIMUM_CATEGORIES = 4

  static evaluateReadiness(
    messages: Array<{ role: string; content: string }>,
    flowState?: ConversationState
  ): ReadinessScore {
    const conversationText = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase())
      .join(' ')

    const categories = this.analyzeCategories(conversationText, messages)
    const missingCritical = this.getMissingCriticalCategories(categories)
    
    const overall = this.calculateOverallScore(categories)
    const isReady = this.checkReadiness(categories, missingCritical)
    const nextFocus = this.determineNextFocus(categories, missingCritical)

    return {
      overall,
      categories,
      missingCritical,
      isReady,
      nextFocus
    }
  }

  private static analyzeCategories(conversationText: string, messages: Array<{ role: string; content: string }>): ReadinessScore['categories'] {
    const categories = {
      problem: 0,
      users: 0,
      workflow: 0,
      features: 0,
      business: 0,
      technical: 0
    }

    // Problem/Purpose analysis
    if (conversationText.includes('problem') || conversationText.includes('solve') || conversationText.includes('issue')) {
      categories.problem += 40
    }
    if (conversationText.includes('purpose') || conversationText.includes('goal') || conversationText.includes('objective')) {
      categories.problem += 30
    }
    if (conversationText.includes('why') || conversationText.includes('reason') || conversationText.includes('motivation')) {
      categories.problem += 20
    }

    // Users analysis
    if (conversationText.includes('user') || conversationText.includes('customer') || conversationText.includes('audience')) {
      categories.users += 40
    }
    if (conversationText.includes('persona') || conversationText.includes('demographic') || conversationText.includes('profile')) {
      categories.users += 30
    }
    if (conversationText.includes('need') || conversationText.includes('pain point') || conversationText.includes('challenge')) {
      categories.users += 20
    }

    // Workflow analysis
    if (conversationText.includes('workflow') || conversationText.includes('process') || conversationText.includes('journey')) {
      categories.workflow += 40
    }
    if (conversationText.includes('step') || conversationText.includes('flow') || conversationText.includes('path')) {
      categories.workflow += 30
    }
    if (conversationText.includes('how') || conversationText.includes('way') || conversationText.includes('method')) {
      categories.workflow += 20
    }

    // Features analysis
    if (conversationText.includes('feature') || conversationText.includes('function') || conversationText.includes('capability')) {
      categories.features += 40
    }
    if (conversationText.includes('action') || conversationText.includes('task') || conversationText.includes('activity')) {
      categories.features += 30
    }
    if (conversationText.includes('can') || conversationText.includes('able to') || conversationText.includes('allow')) {
      categories.features += 20
    }

    // Business analysis
    if (conversationText.includes('business') || conversationText.includes('revenue') || conversationText.includes('profit')) {
      categories.business += 40
    }
    if (conversationText.includes('success') || conversationText.includes('metric') || conversationText.includes('kpi')) {
      categories.business += 30
    }
    if (conversationText.includes('value') || conversationText.includes('benefit') || conversationText.includes('outcome')) {
      categories.business += 20
    }

    // Technical analysis
    if (conversationText.includes('technical') || conversationText.includes('platform') || conversationText.includes('technology')) {
      categories.technical += 40
    }
    if (conversationText.includes('integration') || conversationText.includes('api') || conversationText.includes('database')) {
      categories.technical += 30
    }
    if (conversationText.includes('mobile') || conversationText.includes('web') || conversationText.includes('app')) {
      categories.technical += 20
    }

    // Add content length bonuses
    messages.forEach(msg => {
      if (msg.role === 'user' && msg.content.length > 100) {
        const content = msg.content.toLowerCase()
        if (content.includes('problem') || content.includes('purpose')) categories.problem += Math.min(20, msg.content.length / 50)
        if (content.includes('user') || content.includes('customer')) categories.users += Math.min(20, msg.content.length / 50)
        if (content.includes('workflow') || content.includes('process')) categories.workflow += Math.min(20, msg.content.length / 50)
        if (content.includes('feature') || content.includes('function')) categories.features += Math.min(20, msg.content.length / 50)
        if (content.includes('business') || content.includes('success')) categories.business += Math.min(20, msg.content.length / 50)
        if (content.includes('technical') || content.includes('platform')) categories.technical += Math.min(20, msg.content.length / 50)
      }
    })

    // Cap at 100
    Object.keys(categories).forEach(key => {
      categories[key as keyof typeof categories] = Math.min(100, categories[key as keyof typeof categories])
    })

    return categories
  }

  private static getMissingCriticalCategories(categories: ReadinessScore['categories']): string[] {
    const missing = []
    if (categories.problem < 50) missing.push('problem statement')
    if (categories.users < 50) missing.push('target users')
    if (categories.workflow < 50) missing.push('user workflow')
    if (categories.features < 50) missing.push('key features')
    if (categories.business < 50) missing.push('business objectives')
    if (categories.technical < 30) missing.push('technical context')
    return missing
  }

  private static calculateOverallScore(categories: ReadinessScore['categories']): number {
    const values = Object.values(categories)
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
  }

  private static checkReadiness(categories: ReadinessScore['categories'], missingCritical: string[]): boolean {
    // Must have at least 4 categories with 50+ score
    const sufficientCategories = Object.values(categories).filter(score => score >= 50).length
    return sufficientCategories >= this.MINIMUM_CATEGORIES && missingCritical.length <= 2
  }

  private static determineNextFocus(categories: ReadinessScore['categories'], missingCritical: string[]): string {
    if (missingCritical.length === 0) {
      // All critical info present, suggest refinement
      const lowestCategory = Object.entries(categories).reduce((min, [key, val]) => 
        val < min.val ? { key, val } : min, 
        { key: 'problem', val: 100 }
      )
      return `refine ${lowestCategory.key.replace('_', ' ')} details`
    }

    // Focus on most critical missing category
    const priorityOrder = ['problem statement', 'target users', 'user workflow', 'key features', 'business objectives', 'technical context']
    for (const category of priorityOrder) {
      if (missingCritical.includes(category)) {
        return `explore ${category}`
      }
    }

    return missingCritical[0]
  }

  static getReadinessStatus(readiness: ReadinessScore): {
    stage: 'discovery' | 'ready' | 'refinement'
    message: string
    color: 'red' | 'yellow' | 'green'
  } {
    if (!readiness.isReady) {
      return {
        stage: 'discovery',
        message: `Discovery phase - ${readiness.nextFocus}`,
        color: 'red'
      }
    }

    if (readiness.overall < 85) {
      return {
        stage: 'ready',
        message: 'Ready for PRD draft - good foundation established',
        color: 'yellow'
      }
    }

    return {
      stage: 'refinement',
      message: 'Refinement phase - strong foundation, can improve details',
      color: 'green'
    }
  }
}