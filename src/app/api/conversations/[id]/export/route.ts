import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { createRequestId, readQueryParam, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { schemas } from '@/lib/api/validate'
import { marked } from 'marked'
import jsPDF from 'jspdf'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/conversations/[id]/export'
  
  try {
    const { userId } = getAuthUser(request)
    const { id: conversationId } = await params
    const format = readQueryParam(request, 'format') || 'markdown'
    
    // Rate limiting: 30 requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 30, windowMs: 10 * 60 * 1000 })
    
    // Validate conversation ID format
    schemas.uuid.parse(conversationId)

    // Validate format
    if (!['markdown', 'pdf'].includes(format)) {
      throw new Error('Invalid format. Must be markdown or pdf')
    }

    // Get conversation
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !conversation) {
      throw new Error('Conversation not found')
    }

    if (!conversation.generated_prd) {
      throw new Error('No PRD generated yet')
    }

    if (format === 'pdf') {
      // Generate proper PDF with markdown parsing
      const pdfBuffer = await generatePDF(conversation.generated_prd, conversation.project_name || 'PRD')
      
      Logger.info('PDF exported successfully', {
        requestId,
        route,
        userId,
        conversationId,
        format: 'pdf',
        projectName: conversation.project_name,
        durationMs: Date.now() - startTime
      })

      const response = new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${conversation.project_name || 'PRD'}.pdf"`,
          'x-request-id': requestId
        }
      })
      return addRequestIdHeader(response, requestId)
    }

    // Return markdown file
    const markdown = conversation.generated_prd
    const filename = `${conversation.project_name || 'PRD'}.md`

    Logger.info('Markdown exported successfully', {
      requestId,
      route,
      userId,
      conversationId,
      format: 'markdown',
      projectName: conversation.project_name,
      durationMs: Date.now() - startTime
    })

    const response = new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to export conversation', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}

async function generatePDF(markdown: string, title: string): Promise<Buffer> {
  try {
    // Parse markdown directly (better than HTML conversion)
    const pdfBuffer = await generatePDFWithJsPDF(markdown, title)
    
    return pdfBuffer
  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error('Failed to generate PDF')
  }
}

async function generatePDFWithJsPDF(markdown: string, title: string): Promise<Buffer> {
  try {
    // Initialize jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Set font
    doc.setFont('helvetica')
    
    // Add title
    doc.setFontSize(20)
    doc.text(title, 20, 30)
    
    // Add subtitle
    doc.setFontSize(12)
    doc.text('Product Requirements Document', 20, 40)
    
    // Add line under title
    doc.setLineWidth(0.5)
    doc.line(20, 45, 190, 45)
    
    // Process markdown content directly
    let yPosition = 60
    const lineHeight = 7
    const pageHeight = 280
    const margin = 20
    const maxWidth = 170
    
    // Split markdown into lines and process
    const lines = markdown.split('\n')
    let inCodeBlock = false
    let codeBlockContent = []
    
    for (const line of lines) {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block - add the content
          if (codeBlockContent.length > 0) {
            yPosition += lineHeight
            doc.setFontSize(9)
            doc.setFont('courier', 'normal')
            doc.text('Code:', margin, yPosition)
            yPosition += lineHeight
            
            for (const codeLine of codeBlockContent) {
              if (yPosition > pageHeight) {
                doc.addPage()
                yPosition = 30
              }
              doc.text(codeLine.substring(0, 60), margin + 5, yPosition) // Limit code line width
              yPosition += lineHeight * 0.8
            }
          }
          codeBlockContent = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        continue
      }
      
      if (inCodeBlock) {
        codeBlockContent.push(line)
        continue
      }
      
      // Skip empty lines
      if (line.trim() === '') {
        yPosition += lineHeight / 2
        continue
      }
      
      // Check if we need a new page
      if (yPosition > pageHeight) {
        doc.addPage()
        yPosition = 30
      }
      
      // Handle headers
      if (line.startsWith('# ')) {
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        const headerText = line.substring(2).trim()
        doc.text(headerText, margin, yPosition)
        yPosition += lineHeight * 1.5
      } else if (line.startsWith('## ')) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        const headerText = line.substring(3).trim()
        doc.text(headerText, margin, yPosition)
        yPosition += lineHeight * 1.3
      } else if (line.startsWith('### ')) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        const headerText = line.substring(4).trim()
        doc.text(headerText, margin, yPosition)
        yPosition += lineHeight * 1.2
      } else if (line.startsWith('#### ')) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        const headerText = line.substring(5).trim()
        doc.text(headerText, margin, yPosition)
        yPosition += lineHeight * 1.1
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const bulletText = processInlineFormatting(line.substring(2).trim())
        doc.text('• ' + bulletText, margin + 5, yPosition)
        yPosition += lineHeight
      } else if (line.match(/^\d+\. /)) {
        // Numbered lists
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const listText = processInlineFormatting(line)
        doc.text(listText, margin + 5, yPosition)
        yPosition += lineHeight
      } else if (line.startsWith('> ')) {
        // Blockquotes
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        const quoteText = line.substring(2).trim()
        doc.text('"' + quoteText + '"', margin + 5, yPosition)
        yPosition += lineHeight
      } else {
        // Regular text with inline formatting
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        
        const processedLine = processInlineFormatting(line)
        
        // Handle long lines by wrapping them
        const words = processedLine.split(' ')
        let currentLine = ''
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word
          const textWidth = doc.getTextWidth(testLine)
          
          if (textWidth > maxWidth && currentLine) {
            doc.text(currentLine, margin, yPosition)
            currentLine = word
            yPosition += lineHeight
            
            if (yPosition > pageHeight) {
              doc.addPage()
              yPosition = 30
            }
          } else {
            currentLine = testLine
          }
        }
        
        if (currentLine) {
          doc.text(currentLine, margin, yPosition)
          yPosition += lineHeight
        }
      }
    }
    
    // Add footer
    const pageCount = doc.internal.pages.length - 1
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(`Generated by AI PRD Assistant on ${new Date().toLocaleDateString()}`, margin, 285)
      doc.text(`Page ${i} of ${pageCount}`, 190 - doc.getTextWidth(`Page ${i} of ${pageCount}`), 285)
    }
    
    // Get PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return pdfBuffer
  } catch (error) {
    console.error('jsPDF generation error:', error)
    throw new Error('Failed to generate PDF with jsPDF')
  }
}

function processInlineFormatting(text: string): string {
  // Process inline markdown formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** markers (jsPDF doesn't support bold in normal text)
    .replace(/\*(.*?)\*/g, '$1') // Remove *italic* markers
    .replace(/`(.*?)`/g, '$1') // Remove `code` markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert [text](url) to just text
    .trim()
}
