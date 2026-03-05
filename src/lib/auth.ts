import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { User } from '@/types'
import { supabaseAdmin } from './supabase'

const JWT_SECRET = process.env.JWT_SECRET!

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser extends Omit<User, 'created_at'> {
  token: string
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  generateToken(user: Omit<User, 'created_at'>): string {
    return jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as SignOptions
    )
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (error) {
      throw new Error('Invalid token')
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
    const token = this.generateToken(user)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      token
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

    const token = this.generateToken(user)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      token
    }
  }
}

export const authService = new AuthService()
