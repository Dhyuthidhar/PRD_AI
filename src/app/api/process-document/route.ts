import { NextRequest, NextResponse } from 'next/server'
import { documentProcessor } from '@/lib/documentProcessor'
import { qwen3Service } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, parseJson, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/process-document'
  
  try {
    // Rate limiting: 20 requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 20, windowMs: 10 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    const { fileId } = validateBody(schemas.processDocument, await parseJson(request))

    // Process the document
    const processedDoc = await documentProcessor.processDocument(fileId)

    // Get file metadata for context
    const { data: fileData } = await supabaseAdmin
      .from('uploaded_files')
      .select('*')
      .eq('id', fileId)
      .single()

    // Analyze with AI
    const analysis = await qwen3Service.analyzeDocument(
      processedDoc.text,
      processedDoc.images
    )

    Logger.info('Document processed successfully', {
      requestId,
      route,
      userId,
      fileId,
      filename: fileData?.filename,
      pageCount: processedDoc.pageCount,
      textLength: processedDoc.text.length,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({
      analysis,
      metadata: {
        filename: fileData?.filename,
        pageCount: processedDoc.pageCount,
        imageCount: processedDoc.images.length,
        textLength: processedDoc.text.length
      }
    })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to process document', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
