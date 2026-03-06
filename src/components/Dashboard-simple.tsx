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
    // Simple auth check - make a test API call to verify auth
    const checkAuth = async () => {
      try {
        console.log('Checking authentication...')
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
        console.log('Auth check response:', response.status)
        
        if (response.ok) {
          // User is authenticated
          fetchConversations()
          fetchUser()
        } else {
          console.log('Auth failed, redirecting to login')
          router.push('/login')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const fetchConversations = async () => {
    try {
      console.log('Fetching conversations...')
      const response = await fetch('/api/conversations', {
        credentials: 'include'
      })
      console.log('Conversations response:', response.status)
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    }
  }

  const fetchUser = async () => {
    try {
      console.log('Fetching user...')
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      console.log('User response:', response.status)
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
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
      console.error('Logout error:', error)
      router.push('/login')
    }
  }

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">PRD Assistant</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Conversations List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-medium text-gray-900">Conversations</h2>
          </div>
          
          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p className="mb-4">No conversations found</p>
              <button
                onClick={() => router.push('/conversation/new')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create your first conversation
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => router.push(`/conversation/${conversation.id}`)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {conversation.project_name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Created: {new Date(conversation.created_at).toLocaleDateString()}</span>
                        <span>Modified: {new Date(conversation.last_modified).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          conversation.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {conversation.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}