import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { createRequestId, readQueryParam, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { schemas } from '@/lib/api/validate'
import { marked } from 'marked'
import puppeteer from 'puppeteer'

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
      const cleaned = removeSectionSummaries(conversation.generated_prd)
      const dedupedContent = deduplicatePRDSections(cleaned)
      const pdfBuffer = await generatePDF(dedupedContent, conversation.project_name || 'PRD')
      
      // Check if we got a PDF or fallback markdown
      const isPDF = pdfBuffer.length > 1000 && !pdfBuffer.toString('utf8', 0, 10).startsWith('# ')
      
      if (isPDF) {
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
      } else {
        // Fallback to markdown
        Logger.error('PDF generation failed, returning markdown fallback', {
          requestId,
          route,
          userId,
          conversationId,
          projectName: conversation.project_name,
          durationMs: Date.now() - startTime
        })

        const response = new NextResponse(pdfBuffer.toString('utf8'), {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': `attachment; filename="${conversation.project_name || 'PRD'}.md"`,
            'x-request-id': requestId
          }
        })
        return addRequestIdHeader(response, requestId)
      }
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
    // Use puppeteer for PDF generation
    const pdfBuffer = await generatePDFWithPuppeteer(markdown, title)
    return pdfBuffer
  } catch (puppeteerError) {
    Logger.error('Puppeteer PDF generation failed, falling back to markdown', puppeteerError, { title })
    
    // Fallback: return markdown as text file
    const fallbackContent = `# ${title}\n\n${markdown}`
    return Buffer.from(fallbackContent, 'utf-8')
  }
}

async function generatePDFWithPuppeteer(markdown: string, title: string): Promise<Buffer> {
  let browser
  try {
    // Convert markdown to HTML
    const html = await marked(markdown)
    
    // Create complete HTML document with styling
    const htmlTemplate = createHTMLTemplate(html, title)
    
    // Launch puppeteer
    browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    })
    const page = await browser.newPage()
    
    // Set content and wait for it to load
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' })
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="
          font-size: 10px;
          color: #374151;
          padding: 20px 40px 0 46px;
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="font-weight: 600;">${title}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
      footerTemplate: `
        <div style="
          font-size: 9px;
          color: #9ca3af;
          padding: 0 40px 20px 46px;
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span>Confidential — AI PRD Assistant</span>
          <span>${title}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
      margin: { 
        top: '60px', 
        bottom: '50px', 
        left: '20px', 
        right: '20px' 
      }
    })
    
    return Buffer.from(pdfBuffer)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

function createHTMLTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - PRD</title>
  <style>
    @page {
      size: A4;
      margin: 60px 20px 50px 20px;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #374151;
      margin: 0;
      padding: 0;
      background: linear-gradient(to right, #6366f1 6px, transparent 6px);
      background-size: 6px 100%;
      background-position: left top;
      background-repeat: repeat-y;
    }
    
    .cover-page {
      background: #1e2a4a;
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
    }
    
    .cover-page h1 {
      font-size: 48px;
      font-weight: 700;
      margin: 0 0 20px 0;
    }
    
    .cover-page h2 {
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 30px 0;
    }
    
    .cover-page .accent-line {
      width: 130px;
      height: 2px;
      background: #6366f1;
      margin: 30px 0;
    }
    
    .cover-page .meta {
      font-size: 14px;
      color: #e5e7eb;
      margin: 40px 0 10px 0;
    }
    
    .cover-page .date {
      font-size: 12px;
      color: #9ca3af;
      position: absolute;
      bottom: 30px;
      right: 40px;
    }
    
    .content-page {
      padding-left: 26px;
    }
    
    h1 {
      font-size: 18px;
      font-weight: 700;
      color: #6366f1;
      margin: 0 0 8px 0;
      page-break-before: always;
    }
    
    h1:first-of-type {
      page-break-before: auto;
    }
    
    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      margin: 20px 0 4px 0;
    }
    
    h3 {
      font-size: 11px;
      font-weight: 700;
      color: #374151;
      margin: 16px 0 4px 0;
    }
    
    p {
      margin: 0 0 8px 0;
    }
    
    ul, ol {
      margin: 0 0 8px 0;
      padding-left: 20px;
    }
    
    li {
      margin-bottom: 4px;
    }
    
    strong, b {
      font-weight: 700;
    }
    
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 20px 0;
    }
    
    .section-divider {
      border-bottom: 1px solid #f3f4f6;
      margin: 0 0 12px 0;
      padding-bottom: 6px;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <h1>PRD</h1>
    <h2>${title}</h2>
    <div class="accent-line"></div>
    <div class="meta">Generated by AI PRD Assistant</div>
    <div class="date">${new Date().toLocaleDateString()}</div>
  </div>
  
  <!-- Content Pages -->
  <div class="content-page">
    ${content}
  </div>
</body>
</html>
  `
}

function removeSectionSummaries(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Remove ONLY the ### Summary heading line itself
    // Keep all content that follows — it is the real section content
    const isSummaryHeading =
      line.match(/^###\s+Summary of the PRD/i) ||
      line.match(/^###\s+Summary of the Project Requirements/i) ||
      line.match(/^###\s+Product Requirements Document/i)

    if (isSummaryHeading) {
      // Skip ONLY this one heading line, continue to next line
      // The content below it will be preserved normally
      continue
    }

    result.push(line)
  }

  return result.join('\n')
}

function deduplicatePRDSections(markdown: string): string {
  // Normalize line endings
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  const lines = normalized.split('\n')
  const seenHeadings = new Set<string>()
  const result: string[] = []
  let skipSection = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Check if this is a ## section heading (level 2 only)
    const h2Match = line.match(/^##\s+(.+)$/)
    
    if (h2Match) {
      const headingKey = h2Match[1].trim().toLowerCase()
      
      if (seenHeadings.has(headingKey)) {
        // Duplicate — remove previous content and keep this one (last-wins strategy)
        // Find and remove previous section content
        const previousHeadingIndex = result.findIndex(line => 
          line.match(/^##\s+/) && 
          line.toLowerCase().includes(headingKey)
        )
        
        if (previousHeadingIndex !== -1) {
          // Remove everything from previous heading to this point
          result.splice(previousHeadingIndex)
        }
        
        seenHeadings.add(headingKey)
        skipSection = false
        result.push(line)
      } else {
        seenHeadings.add(headingKey)
        skipSection = false
        result.push(line)
      }
    } else if (skipSection) {
      // Skip all lines until next ## heading
      continue
    } else {
      result.push(line)
    }
  }
  
  return result.join('\n')
}
