'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Conversation {
  id: string
  project_name: string
  status: 'in_progress' | 'completed'
  created_at: string
  last_modified: string
}

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
        
        if (response.ok) {
          fetchConversations()
          fetchUser()
        } else {
          router.push('/login')
        }
      } catch (error) {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      // Error handling
    }
  }

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      // Error handling
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      router.push('/login')
    } catch (error) {
      router.push('/login')
    }
  }

  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="skeleton h-4 w-32 rounded"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <div className="w-64 flex flex-col" style={{ background: 'var(--color-navy)' }}>
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            PRD Assistant
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center px-4 py-3 text-white rounded-lg hover:bg-white/10 transition-colors border-l-3 border-transparent"
            style={{ borderLeftColor: 'var(--color-accent)' }}
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/conversation/new')}
            className="w-full flex items-center px-4 py-3 text-white/70 rounded-lg hover:bg-white/10 hover:text-white transition-colors border-l-3 border-transparent"
          >
            New Conversation
          </button>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{user?.name}</p>
              <p className="text-white/60 text-xs">Online</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-3 px-4 py-2 text-white/70 text-sm rounded hover:bg-white/10 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                Your Projects
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Manage your PRD conversations
              </p>
            </div>
            <button
              onClick={() => router.push('/conversation/new')}
              className="button-primary"
            >
              New Conversation
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-6 border">
                  <div className="skeleton h-6 w-3/4 rounded mb-4"></div>
                  <div className="skeleton h-4 w-1/2 rounded mb-2"></div>
                  <div className="skeleton h-4 w-1/3 rounded"></div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                No conversations yet
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Start your first PRD conversation to get going
              </p>
              <button
                onClick={() => router.push('/conversation/new')}
                className="button-primary"
              >
                Start your first conversation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => router.push(`/conversation/${conversation.id}`)}
                  className="card-hover bg-white rounded-lg p-6 border cursor-pointer"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                      {conversation.project_name}
                    </h3>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        conversation.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {conversation.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Created: {new Date(conversation.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Modified: {new Date(conversation.last_modified).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}