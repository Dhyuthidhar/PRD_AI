import { NextRequest, NextResponse } from 'next/server'
import { documentProcessor } from '@/lib/documentProcessor'
import { qwen3Service } from '@/lib/huggingface'
import { supabaseAdmin } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = authService.verifyToken(token)
    const { fileId } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 })
    }

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

    return NextResponse.json({
      analysis,
      metadata: {
        filename: fileData?.filename,
        pageCount: processedDoc.pageCount,
        imageCount: processedDoc.images.length,
        textLength: processedDoc.text.length
      }
    })
  } catch (error: any) {
    console.error('Document processing error:', error)
    
    if (error.message?.includes('Password-protected')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    if (error.message?.includes('corrupted')) {
      return NextResponse.json({ error: 'File is corrupted or unreadable.' }, { status: 400 })
    }
    
    if (error.message?.includes('limit')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    )
  }
}
