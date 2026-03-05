import { z } from 'zod'
import { ApiError } from './errors'

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body)
  
  if (!result.success) {
    const errorDetails = result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
    throw new ApiError(400, 'VALIDATION_ERROR', `Validation failed: ${errorDetails}`)
  }
  
  return result.data
}

// Common validation schemas
export const schemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  
  auth: {
    login: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required')
    }),
    
    register: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
      role: z.enum(['user', 'admin']).default('user')
    })
  },
  
  conversation: {
    create: z.object({
      project_name: z.string().min(1, 'Project name is required').max(255, 'Project name too long').optional()
    }),
    
    update: z.object({
      status: z.enum(['in_progress', 'completed']).optional(),
      project_name: z.string().min(1, 'Project name is required').max(255, 'Project name too long').optional()
    }),
    
    message: z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1, 'Message content is required').max(10000, 'Message too long')
    })
  },
  
  chat: z.object({
    conversationId: z.string().uuid('Invalid conversation ID'),
    message: z.string().min(1, 'Message is required').max(10000, 'Message too long')
  }),
  
  processDocument: z.object({
    fileId: z.string().uuid('Invalid file ID')
  })
}
