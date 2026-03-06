import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { User } from '@/types'
import { supabaseAdmin } from './supabase'

const JWT_SECRET = process.env.JWT_SECRET!
const ACCESS_TOKEN_EXPIRES_IN = '15m'  // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'  // 7 days

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser extends Omit<User, 'created_at'> {
  accessToken: string
  refreshToken: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  generateAccessToken(user: Omit<User, 'created_at'>): string {
    return jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      },
      JWT_SECRET,
      { 
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        algorithm: 'HS256'
      }
    )
  }

  generateRefreshToken(): { tokenId: string; token: string } {
    const tokenId = uuidv4()
    const token = jwt.sign(
      { 
        tokenId,
        type: 'refresh'
      },
      JWT_SECRET,
      { 
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        algorithm: 'HS256'
      }
    )
    return { tokenId, token }
  }

  async storeRefreshToken(userId: string, tokenId: string, refreshToken: string): Promise<void> {
    const tokenHash = await bcrypt.hash(refreshToken, 10)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

    const { error } = await supabaseAdmin
      .from('refresh_tokens')
      .insert({
        user_id: userId,
        token_id: tokenId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString()
      })

    if (error) {
      throw new Error('Failed to store refresh token')
    }
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_id', tokenId)

    if (error) {
      throw new Error('Failed to revoke refresh token')
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)

    if (error) {
      throw new Error('Failed to revoke user tokens')
    }
  }

  verifyAccessToken(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256']
      }) as any

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type')
      }

      return decoded
    } catch (error) {
      throw new Error('Invalid access token')
    }
  }

  verifyRefreshToken(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256']
      }) as any

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type')
      }

      return decoded
    } catch (error) {
      throw new Error('Invalid refresh token')
    }
  }

  async validateRefreshToken(tokenId: string, token: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('refresh_tokens')
      .select('token_hash, revoked_at, expires_at')
      .eq('token_id', tokenId)
      .single()

    if (error || !data) {
      return false
    }

    // Check if token is revoked
    if (data.revoked_at) {
      return false
    }

    // Check if token is expired
    if (new Date(data.expires_at) < new Date()) {
      return false
    }

    // Verify token hash
    const isValid = await bcrypt.compare(token, data.token_hash)
    if (!isValid) {
      return false
    }

    // Update last used timestamp
    await supabaseAdmin
      .from('refresh_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token_id', tokenId)

    return true
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const decoded = this.verifyRefreshToken(refreshToken)
    const { tokenId } = decoded

    // Validate refresh token in database
    const isValid = await this.validateRefreshToken(tokenId, refreshToken)
    if (!isValid) {
      throw new Error('Invalid or expired refresh token')
    }

    // Get user info
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      throw new Error('User not found')
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(user)
    const { tokenId: newTokenId, token: newRefreshToken } = this.generateRefreshToken()

    // Store new refresh token and revoke old one
    await this.storeRefreshToken(user.id, newTokenId, newRefreshToken)
    await this.revokeRefreshToken(tokenId)

    return {
      accessToken,
      refreshToken: newRefreshToken
    }
  }

  async createUser(userData: {
    email: string
    password: string
    name: string
    role: string
  }): Promise<AuthUser> {
    const hashedPassword = await this.hashPassword(userData.password)
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role
      })
      .select()
      .single()

    if (error) throw error

    const user = data as User
    
    // Generate token pair
    const accessToken = this.generateAccessToken(user)
    const { tokenId, token: refreshToken } = this.generateRefreshToken()
    
    // Store refresh token
    await this.storeRefreshToken(user.id, tokenId, refreshToken)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', credentials.email)
      .single()

    if (error || !data) {
      throw new Error('User not found')
    }

    const user = data as User & { password: string }
    const isValidPassword = await this.verifyPassword(credentials.password, user.password)

    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Generate token pair
    const accessToken = this.generateAccessToken(user)
    const { tokenId, token: refreshToken } = this.generateRefreshToken()
    
    // Store refresh token
    await this.storeRefreshToken(user.id, tokenId, refreshToken)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken
    }
  }
}

export const authService = new AuthService()
