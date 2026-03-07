import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface ScanResult {
  isClean: boolean
  threat?: string
  error?: string
}

export class VirusScanner {
  private static readonly CLAMAV_PATH = process.env.CLAMAV_PATH || 'clamscan'
  
  static async scanFile(filePath: string): Promise<ScanResult> {
    try {
      // Check if ClamAV is available
      try {
        await execAsync('which clamscan')
      } catch {
        // ClamAV not installed, skip scanning (log warning)
        console.warn('ClamAV not installed - skipping virus scan')
        return { isClean: true }
      }

      // Run ClamAV scan
      const { stdout } = await execAsync(`${this.CLAMAV_PATH} --no-summary ${filePath}`)
      
      if (stdout.includes('FOUND')) {
        const threat = stdout.split('FOUND')[0].trim()
        return { isClean: false, threat }
      }
      
      return { isClean: true }
    } catch (error) {
      console.error('Virus scan failed:', error)
      return { isClean: false, error: 'Scan failed' }
    }
  }
  
  static async scanBuffer(buffer: ArrayBuffer, filename: string): Promise<ScanResult> {
    // Create temporary file for scanning
    const tempDir = '/tmp'
    const tempPath = path.join(tempDir, `scan-${Date.now()}-${filename}`)
    
    try {
      // Write buffer to temp file
      await fs.writeFile(tempPath, new Uint8Array(buffer))
      
      // Scan the file
      const result = await this.scanFile(tempPath)
      
      return result
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
