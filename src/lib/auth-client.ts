'use client'

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface User {
  id: string
  email: string
  name: string
  role: string
}

class AuthClient {
  private static instance: AuthClient
  private refreshPromise: Promise<boolean> | null = null

  static getInstance(): AuthClient {
    if (!AuthClient.instance) {
      AuthClient.instance = new AuthClient()
    }
    return AuthClient.instance
  }

  // Get tokens from cookies
  getTokens(): AuthTokens | null {
    if (typeof document === 'undefined') return null
    
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null
      }
      return null
    }

    const accessToken = getCookie('access-token')
    const refreshToken = getCookie('refresh-token')

    if (!accessToken || !refreshToken) {
      return null
    }

    return { accessToken, refreshToken }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getTokens() !== null
  }

  // Make authenticated API call with auto-refresh
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const tokens = this.getTokens()
    
    if (!tokens) {
      throw new Error('No authentication tokens available')
    }

    // Add access token to headers
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for refresh token
    })

    // If 401, try to refresh token
    if (response.status === 401) {
      const refreshed = await this.refreshToken()
      if (refreshed) {
        // Retry with new token
        const newTokens = this.getTokens()
        if (newTokens) {
          return fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          })
        }
      }
      
      // If refresh failed, redirect to login
      this.redirectToLogin()
      throw new Error('Authentication failed')
    }

    return response
  }

  // Refresh access token
  private async refreshToken(): Promise<boolean> {
    // Prevent multiple refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.doRefreshToken()
    
    try {
      const result = await this.refreshPromise
      return result
    } finally {
      this.refreshPromise = null
    }
  }

  private async doRefreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include refresh token cookie
      })

      if (response.ok) {
        return true
      }
      
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      this.redirectToLogin()
    }
  }

  // Redirect to login page
  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.fetchWithAuth('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        return data.user
      }
      return null
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  }
}

export const authClient = AuthClient.getInstance()
export type { AuthTokens, User }