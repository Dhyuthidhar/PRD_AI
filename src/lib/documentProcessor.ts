import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import sharp from 'sharp'
import { supabaseAdmin } from './supabase'

// Configure PDF.js worker
if (typeof window === 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry.js')
}

export interface ProcessedDocument {
  text: string
  images: string[]
  pageCount: number
  metadata: any
}

export class DocumentProcessor {
  async processDocument(fileId: string): Promise<ProcessedDocument> {
    try {
      // Get file metadata from database
      const { data: fileData, error } = await supabaseAdmin
        .from('uploaded_files')
        .select('*')
        .eq('id', fileId)
        .single()

      if (error || !fileData) {
        throw new Error('File not found')
      }

      // Download file from Supabase Storage
      const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
        .from('prd-uploads')
        .download(fileData.storage_path)

      if (downloadError || !fileBlob) {
        throw new Error('Failed to download file')
      }

      // Convert Blob to ArrayBuffer
      const buffer = await fileBlob.arrayBuffer()

      // Process based on file type
      const fileType = fileData.file_type

      if (fileType === 'application/pdf') {
        return await this.processPDF(buffer, fileData.filename)
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.processDOCX(buffer, fileData.filename)
      } else if (fileType.startsWith('image/')) {
        return await this.processImage(buffer, fileData.filename)
      } else {
        throw new Error('Unsupported file type')
      }
    } catch (error) {
      console.error('Document processing error:', error)
      throw error
    }
  }

  private async processPDF(buffer: ArrayBuffer, filename: string): Promise<ProcessedDocument> {
    try {
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      const numPages = pdf.numPages

      if (numPages > 50) {
        throw new Error('PDF exceeds 50 page limit')
      }

      let fullText = ''
      const images: string[] = []

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        // Extract text
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        fullText += pageText + '\n'

        // Extract images
        const ops = await page.getOperatorList()
        const imageOps = ops.fnArray.filter((fn: number, idx: number) => 
          fn === pdfjsLib.OPS.paintImageXObject || 
          fn === pdfjsLib.OPS.paintInlineImageXObject
        )

        for (const opIdx of imageOps) {
          try {
            const pageIndex = ops.fnArray.indexOf(opIdx)
            const imageObj = ops.argsArray[pageIndex][0]
            
            if (imageObj) {
              const imageData = await page.objs.get(imageObj)
              if (imageData) {
                // Convert image to base64
                const base64Image = await this.convertImageToBase64(imageData)
                images.push(base64Image)
              }
            }
          } catch (error) {
            console.warn('Failed to extract image from page', pageNum, error)
          }
        }
      }

      return {
        text: fullText.trim(),
        images,
        pageCount: numPages,
        metadata: { filename, type: 'pdf' }
      }
    } catch (error: any) {
      if (error.message?.includes('PasswordException')) {
        throw new Error('PDF is password-protected. Upload unlocked version.')
      }
      throw error
    }
  }

  private async processDOCX(buffer: ArrayBuffer, filename: string): Promise<ProcessedDocument> {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      const images: string[] = []

      // Note: mammoth doesn't have built-in image extraction in the basic version
      // For now, we'll process text only. Images would require additional processing.

      return {
        text: result.value,
        images,
        pageCount: 1, // DOCX doesn't have pages
        metadata: { filename, type: 'docx' }
      }
    } catch (error) {
      throw new Error('Failed to process DOCX file')
    }
  }

  private async processImage(buffer: ArrayBuffer, filename: string): Promise<ProcessedDocument> {
    try {
      // Convert image to base64
      const base64Image = `data:image/${filename.split('.').pop()};base64,${Buffer.from(buffer).toString('base64')}`
      
      return {
        text: '', // Images don't have text content
        images: [base64Image],
        pageCount: 1,
        metadata: { filename, type: 'image' }
      }
    } catch (error) {
      throw new Error('Failed to process image file')
    }
  }

  private async convertImageToBase64(imageData: any): Promise<string> {
    try {
      // Convert PDF image to buffer and then to base64
      const imageBuffer = Buffer.from(imageData.data)
      const optimizedBuffer = await sharp(imageBuffer)
        .png()
        .resize({ width: 1024, height: 1024, fit: 'inside' })
        .toBuffer()

      return `data:image/png;base64,${optimizedBuffer.toString('base64')}`
    } catch (error) {
      console.warn('Failed to convert image to base64:', error)
      return ''
    }
  }

  async validateFile(file: File): Promise<{ isValid: boolean; error?: string }> {
    // Check file size
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      return { isValid: false, error: 'File exceeds 25MB limit' }
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ]

    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'Unsupported file type' }
    }

    // For PDFs, check if password protected
    if (file.type === 'application/pdf') {
      try {
        const buffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
        
        // Try to access first page to check for password protection
        await pdf.getPage(1)
      } catch (error: any) {
        if (error.name === 'PasswordException') {
          return { isValid: false, error: 'PDF is password-protected. Upload unlocked version.' }
        }
        if (error.message?.includes('Invalid PDF')) {
          return { isValid: false, error: 'File is corrupted or unreadable.' }
        }
      }
    }

    return { isValid: true }
  }
}

export const documentProcessor = new DocumentProcessor()
