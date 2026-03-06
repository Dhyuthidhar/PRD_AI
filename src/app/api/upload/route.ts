import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/api/auth-guard'
import { validateBody, schemas } from '@/lib/api/validate'
import { createRequestId, readQueryParam, addRequestIdHeader } from '@/lib/api/request'
import { toErrorResponse } from '@/lib/api/errors'
import { Logger } from '@/lib/api/logger'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { fileTypeFromBuffer } from 'file-type'

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startTime = Date.now()
  const route = '/api/upload'
  
  try {
    // Rate limiting: 20 requests per 10 minutes per IP
    enforceRateLimit(request, { limit: 20, windowMs: 10 * 60 * 1000 })
    
    const { userId } = getAuthUser(request)
    const formData = await request.formData()
    const file = formData.get('file') as File
    const conversationId = formData.get('conversationId') as string

    // Validate presence
    if (!file) {
      throw new Error('File is required')
    }
    
    if (!conversationId) {
      throw new Error('Conversation ID is required')
    }

    // Validate conversation ID format
    schemas.upload.conversationId.parse(conversationId)

    // File validation
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      throw new Error('File exceeds 25MB limit')
    }

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Unsupported file type')
    }

    // Additional validation using file-type
    const buffer = await file.arrayBuffer()
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType || !['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(fileType.ext)) {
      throw new Error('Invalid file format')
    }

    // Generate unique storage path
    const storagePath = `${userId}/${conversationId}/${Date.now()}-${file.name}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'prd-uploads')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      throw uploadError
    }

    // Save file metadata to database
    const { data: fileData, error: dbError } = await supabaseAdmin
      .from('uploaded_files')
      .insert({
        conversation_id: conversationId,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    Logger.info('File uploaded successfully', {
      requestId,
      route,
      userId,
      conversationId,
      filename: file.name,
      fileSize: file.size,
      durationMs: Date.now() - startTime
    })

    const response = NextResponse.json({ file: fileData }, { status: 201 })
    return addRequestIdHeader(response, requestId)
    
  } catch (error) {
    Logger.error('Failed to upload file', error, { requestId, route })
    return addRequestIdHeader(toErrorResponse(error, requestId), requestId)
  }
}
