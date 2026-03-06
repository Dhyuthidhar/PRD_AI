import { supabaseAdmin } from './supabase'
import { DocumentContext } from './promptBuilder'

export class DocumentContextService {
  private static migrationChecked = false
  private static hasAnalysisColumn = false

  static async getDocumentContext(conversationId: string): Promise<DocumentContext[]> {
    try {
      // Check for analysis column support on first call
      if (!this.migrationChecked) {
        await this.checkAnalysisColumnSupport()
      }

      // If analysis column doesn't exist, return empty gracefully
      if (!this.hasAnalysisColumn) {
        return []
      }

      const { data: files, error } = await supabaseAdmin
        .from('uploaded_files')
        .select('id, filename, analysis, processed_at, file_size, uploaded_at')
        .eq('conversation_id', conversationId)
        .not('analysis', 'is', null)
        .order('processed_at', { ascending: false })

      if (error) {
        // If column doesn't exist, log warning and return empty
        if (error.message?.includes('column') || error.code === '42703') {
          console.warn('Document analysis column not found - migration may not have run yet')
          this.hasAnalysisColumn = false
          return []
        }
        console.error('Failed to fetch document context:', error)
        return []
      }

      return files.map(file => ({
        filename: file.filename,
        analysis: file.analysis || '',
        timestamp: file.processed_at || file.uploaded_at
      }))
    } catch (error) {
      console.error('Error getting document context:', error)
      return []
    }
  }

  private static async checkAnalysisColumnSupport(): Promise<void> {
    try {
      // Test query to see if analysis column exists
      const { data, error } = await supabaseAdmin
        .from('uploaded_files')
        .select('analysis')
        .limit(1)

      if (error && (error.message?.includes('column') || error.code === '42703')) {
        console.warn('Document analysis persistence not available - migration required')
        this.hasAnalysisColumn = false
      } else {
        this.hasAnalysisColumn = true
      }
    } catch (error) {
      console.warn('Could not verify analysis column support:', error)
      this.hasAnalysisColumn = false
    }
    
    this.migrationChecked = true
  }

  static async hasDocumentContext(conversationId: string): Promise<boolean> {
    if (!this.migrationChecked) {
      await this.checkAnalysisColumnSupport()
    }

    if (!this.hasAnalysisColumn) {
      return false
    }

    const { data, error } = await supabaseAdmin
      .from('uploaded_files')
      .select('id')
      .eq('conversation_id', conversationId)
      .not('analysis', 'is', null)
      .limit(1)

    return !error && data && data.length > 0
  }

  static buildContextSummary(documentContexts: DocumentContext[]): string {
    if (documentContexts.length === 0) return ''

    const summaries = documentContexts.map(doc => {
      const preview = doc.analysis.length > 200 
        ? doc.analysis.substring(0, 200) + '...'
        : doc.analysis

      return `📄 ${doc.filename}: ${preview}`
    }).join('\n\n')

    return `DOCUMENTS AVAILABLE (${documentContexts.length}):\n${summaries}`
  }

  static isAnalysisPersistenceSupported(): boolean {
    return this.hasAnalysisColumn
  }

  static async forceRecheckColumnSupport(): Promise<void> {
    this.migrationChecked = false
    await this.checkAnalysisColumnSupport()
  }
}