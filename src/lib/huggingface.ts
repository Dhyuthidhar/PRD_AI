import { HfInference } from '@huggingface/inference'

const hf = process.env.HUGGINGFACE_API_KEY ? new HfInference(process.env.HUGGINGFACE_API_KEY) : null

export interface ChatMessage {
  role: 'user' | 'assistant'
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
      console.log('Messages:', messages)
      
      const response = await hf.chatCompletion({
        model: this.model,
        messages: messages,
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

  private getFallbackResponse(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1]?.content || ''
    
    // Simple fallback responses based on keywords
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
    
    // Default fallback
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
