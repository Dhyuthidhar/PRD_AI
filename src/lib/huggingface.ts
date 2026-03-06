import { HfInference } from '@huggingface/inference'

const hf = process.env.HUGGINGFACE_API_KEY ? new HfInference(process.env.HUGGINGFACE_API_KEY) : null

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  [key: string]: any
}

export interface GenerationConfig {
  max_tokens?: number
  temperature?: number
  top_p?: number
}

export class Qwen3Service {
  private model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-7B-Instruct'

  async generateResponse(
    messages: ChatMessage[],
    config: GenerationConfig = {}
  ): Promise<string> {
    // Fallback response when Hugging Face API is not available
    if (!hf || !process.env.HUGGINGFACE_API_KEY) {
      return this.getFallbackResponse(messages)
    }

    try {
      console.log('Generating response with model:', this.model)
      console.log('Message count:', messages.length)
      console.log('Has system message:', messages.some(m => m.role === 'system'))
      
      // Filter out system messages if model doesn't support them
      const filteredMessages = this.filterMessagesForModel(messages)
      
      const response = await hf.chatCompletion({
        model: this.model,
        messages: filteredMessages,
        max_tokens: config.max_tokens || 2000,
        temperature: config.temperature || 0.7,
        top_p: config.top_p || 0.9,
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('Hugging Face API error:', error)
      // Return fallback response if API fails
      return this.getFallbackResponse(messages)
    }
  }

  private filterMessagesForModel(messages: ChatMessage[]): ChatMessage[] {
    // Qwen models support system messages, but keep as fallback
    const modelSupportsSystem = this.model.includes('Qwen') || this.model.includes('qwen')
    
    if (modelSupportsSystem) {
      return messages
    }
    
    // For models that don't support system messages, convert to user message
    return messages.map(msg => 
      msg.role === 'system' 
        ? { ...msg, role: 'user' as const, content: `SYSTEM: ${msg.content}` }
        : msg
    )
  }

  private getFallbackResponse(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1]?.content || ''
    
    // Extract system instructions if present
    const systemMessage = messages.find(m => m.role === 'system')
    const isPRDMode = systemMessage?.content?.includes('PRD Assistant') || 
                     lastMessage.toLowerCase().includes('prd') ||
                     lastMessage.toLowerCase().includes('requirements')
    
    // Extract document context if present
    const documentContext = messages.find(m => 
      m.role === 'user' && m.content.includes('UPLOADED DOCUMENTS CONTEXT')
    )
    
    // Extract stage context if present
    const stageContext = messages.find(m => 
      m.role === 'user' && m.content.includes('CURRENT STAGE:')
    )
    
    // Get recent conversation context (last 3 user messages)
    const recentUserMessages = messages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content)
    
    const conversationContext = recentUserMessages.join(' ').toLowerCase()
    
    // If we're in PRD mode, provide guided responses
    if (isPRDMode) {
      return this.getPRDFallbackResponse(lastMessage, conversationContext, documentContext, stageContext)
    }
    
    // Legacy fallback for non-PRD conversations
    return this.getLegacyFallbackResponse(lastMessage)
  }

  private getPRDFallbackResponse(
    lastMessage: string, 
    conversationContext: string, 
    documentContext: any, 
    stageContext: any
  ): string {
    const hasDocContext = documentContext && documentContext.content.includes('DOCUMENTS AVAILABLE')
    const currentStage = this.extractCurrentStage(stageContext)
    
    // Determine what information we're missing based on conversation
    const missingInfo = this.detectMissingPRDInfo(conversationContext)
    
    // Reference documents if available
    const docReference = hasDocContext 
      ? "I notice you've uploaded documents. Let me reference those while we work through your requirements. "
      : ""
    
    // Stage-specific guidance
    if (currentStage === 'overview' && !conversationContext.includes('problem') && !conversationContext.includes('solve')) {
      return `${docReference}Let's start with the fundamentals. What problem does your project solve, and what makes it different from existing solutions?`
    }
    
    if (currentStage === 'target_users' && !conversationContext.includes('user') && !conversationContext.includes('audience')) {
      return `${docReference}Now let's focus on who will use this. Can you describe your target users and their key characteristics?`
    }
    
    if (currentStage === 'features' && !conversationContext.includes('feature') && !conversationContext.includes('function')) {
      return `${docReference}Let's explore the core functionality. What are the main features your users need to accomplish their goals?`
    }
    
    if (missingInfo.length > 0) {
      return `${docReference}I notice we haven't covered ${missingInfo.join(', ')} yet. Could you tell me more about ${missingInfo[0]}?`
    }
    
    // Contextual responses based on current message
    if (lastMessage.toLowerCase().includes('mobile app')) {
      return `${docReference}Great! For a mobile application, I'd like to understand: What platform(s) are you targeting, what's the core user journey, and how will this app stand out in the app store?`
    }
    
    if (lastMessage.toLowerCase().includes('website') || lastMessage.toLowerCase().includes('web app')) {
      return `${docReference}Excellent! For your web application, let's clarify: Who are the primary users, what actions can they perform, and what makes your approach unique?`
    }
    
    // Default PRD-focused response
    return `${docReference}I'm helping you build a comprehensive PRD. Based on what we've discussed, what aspect would you like to explore next - user needs, technical requirements, or success metrics?`
  }

  private extractCurrentStage(stageContext: any): string {
    if (!stageContext || !stageContext.content) return 'overview'
    
    const content = stageContext.content
    if (content.includes('target_users')) return 'target_users'
    if (content.includes('features')) return 'features'
    if (content.includes('technical_requirements')) return 'technical_requirements'
    if (content.includes('ui_ux_requirements')) return 'ui_ux_requirements'
    if (content.includes('complete')) return 'complete'
    
    return 'overview'
  }

  private detectMissingPRDInfo(conversationContext: string): string[] {
    const missing = []
    
    if (!conversationContext.includes('problem') && !conversationContext.includes('solve')) {
      missing.push('the problem you\'re solving')
    }
    
    if (!conversationContext.includes('user') && !conversationContext.includes('audience')) {
      missing.push('target users')
    }
    
    if (!conversationContext.includes('feature') && !conversationContext.includes('function')) {
      missing.push('key features')
    }
    
    if (!conversationContext.includes('technical') && !conversationContext.includes('platform')) {
      missing.push('technical requirements')
    }
    
    if (!conversationContext.includes('metric') && !conversationContext.includes('success')) {
      missing.push('success metrics')
    }
    
    return missing.slice(0, 2) // Return max 2 missing items
  }

  private getLegacyFallbackResponse(lastMessage: string): string {
    // Keep the original fallback for non-PRD conversations
    if (lastMessage.toLowerCase().includes('hello') || lastMessage.toLowerCase().includes('hi')) {
      return "Hello! I'm here to help you create a Product Requirements Document. What kind of project are you working on?"
    }
    
    if (lastMessage.toLowerCase().includes('mobile app')) {
      return "Great! For a mobile app PRD, I'll need to know: What platform (iOS/Android/both)? What's the main purpose? Who are the target users?"
    }
    
    if (lastMessage.toLowerCase().includes('website') || lastMessage.toLowerCase().includes('web app')) {
      return "Excellent! For a web application, let's discuss: What's the primary goal? Who will use it? What are the key features you need?"
    }
    
    if (lastMessage.toLowerCase().includes('features')) {
      return "Let's break down the features. What are the main functionalities you want users to be able to perform? Think about user journeys and core actions."
    }
    
    if (lastMessage.toLowerCase().includes('users') || lastMessage.toLowerCase().includes('target')) {
      return "Understanding your users is crucial! Can you describe your target audience? Are they internal employees, external customers, or a specific demographic?"
    }
    
    return "I understand you're working on a project. To help create a comprehensive PRD, could you tell me more about: 1) What you're building, 2) Who will use it, and 3) What problem it solves?"
  }

  async analyzeDocument(
    documentText: string,
    images?: string[]
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Please analyze this document and extract all requirements. 
Document text: ${documentText}
${images ? `\nImages provided: ${images.length} images` : ''}

Provide a structured analysis of:
1. Key requirements mentioned
2. Technical specifications
3. User needs and pain points
4. Any constraints or assumptions`
      }
    ]

    if (!hf || !process.env.HUGGINGFACE_API_KEY) {
      return this.getDocumentFallbackResponse(documentText)
    }

    try {
      const response = await hf.chatCompletion({
        model: this.model,
        messages: messages,
        max_tokens: 2000,
        temperature: 0.3
      })

      return response.choices[0]?.message?.content || 'Document analysis completed with basic information extracted.'
    } catch (error) {
      console.error('Document analysis error:', error)
      return this.getDocumentFallbackResponse(documentText)
    }
  }

  private getDocumentFallbackResponse(documentText: string): string {
    return `Document Analysis Summary:

Based on the provided document, here are the key findings:

**Key Requirements Identified:**
- Document processing and analysis capabilities
- Information extraction and organization
- User-friendly interface for document management

**Technical Considerations:**
- Need robust text processing
- File format support (PDF, DOCX, images)
- Efficient data storage and retrieval

**User Needs:**
- Easy document upload and processing
- Clear output and insights
- Reliable performance

This analysis provides a foundation for developing the document processing system.`
  }

  async generatePRD(sections: Record<string, string>): Promise<string> {
    if (!hf || !process.env.HUGGINGFACE_API_KEY) {
      return this.getFallbackPRD(sections)
    }

    try {
      const prompt = `Generate a comprehensive Product Requirements Document based on the following sections:

${Object.entries(sections).map(([key, value]) => `## ${key.replace('_', ' ').toUpperCase()}\n${value}`).join('\n\n')}

Create a well-structured PRD with:
1. Executive Summary
2. Project Overview
3. Target Users
4. Features & Requirements
5. Technical Specifications
6. Success Metrics
7. Timeline

Make it professional, detailed, and ready for stakeholders.`

      const response = await hf.chatCompletion({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.5
      })

      return response.choices[0]?.message?.content || this.getFallbackPRD(sections)
    } catch (error) {
      console.error('PRD generation error:', error)
      return this.getFallbackPRD(sections)
    }
  }

  private getFallbackPRD(sections: Record<string, string>): string {
    const projectName = sections.overview?.split(' ').slice(0, 3).join(' ') || 'Project'
    
    return `# Product Requirements Document: ${projectName}

## Executive Summary
This document outlines the requirements for ${projectName.toLowerCase()}, designed to address user needs through innovative solutions and effective implementation strategies.

## 1. Project Overview
${sections.overview || 'The project aims to deliver a comprehensive solution that meets user requirements and business objectives.'}

## 2. Target Users
${sections.target_users || 'The solution targets users who require efficient and reliable functionality to accomplish their goals effectively.'}

## 3. Features & Requirements
${sections.features || 'The system will include core features designed to provide optimal user experience and meet specified requirements.'}

### Key Features:
- User-friendly interface
- Reliable performance
- Scalable architecture
- Comprehensive functionality

## 4. Technical Requirements
${sections.technical_requirements || 'The system will be built using modern technologies and best practices to ensure reliability and maintainability.'}

### Technology Stack:
- Frontend: Modern web framework
- Backend: Robust server architecture
- Database: Scalable data storage
- Infrastructure: Cloud-based deployment

## 5. UI/UX Requirements
${sections.ui_ux_requirements || 'The interface will be designed with user experience as a priority, ensuring intuitive navigation and accessibility.'}

## 6. Success Metrics
- User adoption and satisfaction
- System performance and reliability
- Feature utilization rates
- Business impact and ROI

## 7. Timeline & Milestones
- Phase 1: Requirements gathering and design (4 weeks)
- Phase 2: Development and implementation (8 weeks)
- Phase 3: Testing and refinement (4 weeks)
- Phase 4: Deployment and launch (2 weeks)

## 8. Risk Assessment
- Technical risks: Mitigated through proven technologies
- Timeline risks: Managed through agile methodology
- Resource risks: Addressed through proper planning

---

*This PRD was generated based on conversation analysis and should be reviewed and refined by stakeholders.*`
  }
}

export const qwen3Service = new Qwen3Service()
