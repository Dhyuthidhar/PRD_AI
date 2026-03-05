import { describe, it, expect, beforeEach } from 'vitest'
import { authService } from '@/lib/auth'
import { validateBody, schemas } from '@/lib/api/validate'
import { ApiError } from '@/lib/api/errors'

describe('AuthService', () => {
  it('should hash password with bcrypt', async () => {
    const password = 'testPassword123'
    const hash = await authService.hashPassword(password)
    
    expect(hash).not.toBe(password)
    expect(hash.length).toBeGreaterThan(50)
    expect(hash.startsWith('$2b$12$')).toBe(true)
  })

  it('should verify password correctly', async () => {
    const password = 'testPassword123'
    const hash = await authService.hashPassword(password)
    
    const isValid = await authService.verifyPassword(password, hash)
    expect(isValid).toBe(true)
    
    const isInvalid = await authService.verifyPassword('wrongPassword', hash)
    expect(isInvalid).toBe(false)
  })

  it('should generate and verify JWT token', () => {
    const user = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    }
    
    const token = authService.generateToken(user)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    
    const decoded = authService.verifyToken(token)
    expect(decoded.userId).toBe(user.id)
    expect(decoded.email).toBe(user.email)
    expect(decoded.role).toBe(user.role)
  })

  it('should throw error for invalid token', () => {
    expect(() => {
      authService.verifyToken('invalid.token.here')
    }).toThrow('Invalid token')
  })
})

describe('Validation', () => {
  it('should validate login schema correctly', () => {
    const validData = { email: 'test@example.com', password: 'password123' }
    const result = validateBody(schemas.auth.login, validData)
    expect(result).toEqual(validData)
  })

  it('should throw validation error for invalid email', () => {
    const invalidData = { email: 'invalid-email', password: 'password123' }
    
    expect(() => {
      validateBody(schemas.auth.login, invalidData)
    }).toThrow(ApiError)
  })

  it('should throw validation error for missing password', () => {
    const invalidData = { email: 'test@example.com' }
    
    expect(() => {
      validateBody(schemas.auth.login, invalidData)
    }).toThrow(ApiError)
  })

  it('should validate register schema correctly', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'user'
    }
    const result = validateBody(schemas.auth.register, validData)
    expect(result).toEqual(validData)
  })

  it('should enforce password minimum length', () => {
    const invalidData = {
      email: 'test@example.com',
      password: '123',
      name: 'Test User'
    }
    
    expect(() => {
      validateBody(schemas.auth.register, invalidData)
    }).toThrow(ApiError)
  })
})
