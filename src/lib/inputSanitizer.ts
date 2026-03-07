// Simple HTML sanitization without external dependencies
export interface SanitizationOptions {
  allowHTML?: boolean
  maxLength?: number
  removeScripts?: boolean
  removeStyles?: boolean
}

export class InputSanitizer {
  private static readonly DEFAULT_OPTIONS: SanitizationOptions = {
    allowHTML: false,
    maxLength: 10000,
    removeScripts: true,
    removeStyles: true
  }

  static sanitizeText(input: string, options: SanitizationOptions = {}): string {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    
    let sanitized = input
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    
    // Remove potential prompt injection patterns
    sanitized = this.removePromptInjection(sanitized)
    
    // Length limit
    if (opts.maxLength && sanitized.length > opts.maxLength) {
      sanitized = sanitized.substring(0, opts.maxLength)
    }
    
    // HTML sanitization if needed
    if (opts.allowHTML) {
      sanitized = this.sanitizeHTML(sanitized)
    } else {
      // Remove all HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '')
    }
    
    return sanitized.trim()
  }
  
  private static sanitizeHTML(html: string): string {
    // Very basic HTML sanitization - allow only safe tags
    const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br']
    const tagPattern = new RegExp(`<(?!/?(${allowedTags.join('|')})\s*\/?>)[^>]*>`, 'gi')
    return html.replace(tagPattern, '')
  }
  
  private static removePromptInjection(input: string): string {
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /system\s*:\s*/gi,
      /assistant\s*:\s*/gi,
      /\[\/INST\]/gi,
      /\[INST\]/gi,
      /<\|im_start\|>/gi,
      /<\|im_end\|>/gi,
      /acting\s+as\s+a\s+different\s+assistant/gi,
      /pretend\s+you\s+are/gi,
      /roleplay\s+as/gi
    ]
    
    let sanitized = input
    for (const pattern of injectionPatterns) {
      sanitized = sanitized.replace(pattern, '')
    }
    
    return sanitized
  }
  
  static validateMessage(content: string): { isValid: boolean; reason?: string } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, reason: 'Message cannot be empty' }
    }
    
    if (content.length > 10000) {
      return { isValid: false, reason: 'Message too long' }
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /on\w+\s*=/i
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { isValid: false, reason: 'Message contains suspicious content' }
      }
    }
    
    return { isValid: true }
  }
}
