import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import { fileTypeFromBuffer } from 'file-type'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const formData = await request.formData()
    const file = formData.get('file') as File
    const conversationId = formData.get('conversationId') as string

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Missing file or conversation ID' }, { status: 400 })
    }

    // File validation
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 400 })
    }

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    // Additional validation using file-type
    const buffer = await file.arrayBuffer()
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType || !['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(fileType.ext)) {
      return NextResponse.json({ error: 'Invalid file format' }, { status: 400 })
    }

    // Generate unique storage path
    const storagePath = `${decoded.userId}/${conversationId}/${Date.now()}-${file.name}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('prd-uploads')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
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
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to save file metadata' }, { status: 500 })
    }

    return NextResponse.json({ file: fileData }, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
