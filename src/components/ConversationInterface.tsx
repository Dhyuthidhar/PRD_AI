'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Conversation {
  id: string
  project_name: string
  status: 'in_progress' | 'completed'
  messages: Message[]
  generated_prd?: string
}

export default function ConversationInterface({ conversationId }: { conversationId?: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId)
    } else if (!isCreatingNew && !conversation) {
      setIsCreatingNew(true)
      startNewConversation()
    }
  }, [conversationId, isCreatingNew])

  useEffect(() => {
    scrollToBottom()
  }, [conversation?.messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`)
      if (response.ok) {
        const data = await response.json()
        setConversation(data.conversation)
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const startNewConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: 'New Project' })
      })
      
      if (response.ok) {
        const data = await response.json()
        const newConversation = data.conversation
        
        // Start with initial AI message
        await sendInitialMessage(newConversation.id)
        setConversation(newConversation)
        router.replace(`/conversation/${newConversation.id}`)
      }
    } catch (error) {
      console.error('Failed to start conversation:', error)
    }
  }

  const sendInitialMessage = async (convId: string) => {
    const initialMessage = {
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: "Hello! I'm your AI PRD Assistant. Do you have an existing PRD or brief document you'd like me to analyze, or would you like to start gathering requirements from scratch?",
      timestamp: new Date().toISOString()
    }

    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialMessage)
      })
    } catch (error) {
      console.error('Failed to send initial message:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversation || isTyping) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    }

    // Add user message immediately
    const updatedConversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage]
    }
    setConversation(updatedConversation)
    setInputMessage('')
    setIsTyping(true)

    try {
      // Save user message
      await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage)
      })

      // Get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          message: inputMessage.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMessage = {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: data.response,
          timestamp: new Date().toISOString()
        }

        // Add AI message
        const finalConversation = {
          ...updatedConversation,
          messages: [...updatedConversation.messages, aiMessage]
        }
        setConversation(finalConversation)

        // Save AI message
        await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiMessage)
        })
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsTyping(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !conversation) return

    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)
    formData.append('conversationId', conversation.id)

    try {
      setIsLoading(true)
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        
        // Add file processing message
        const fileMessage = {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: `I've received your file "${file.name}". Let me analyze it...`,
          timestamp: new Date().toISOString()
        }

        setConversation(prev => prev ? {
          ...prev,
          messages: [...prev.messages, fileMessage]
        } : null)

        // Process the file
        const processResponse = await fetch('/api/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: data.file.id })
        })

        if (processResponse.ok) {
          const processData = await processResponse.json()
          const analysisMessage = {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: processData.analysis,
            timestamp: new Date().toISOString()
          }

          setConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, analysisMessage]
          } : null)
        }
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const generatePRD = async () => {
    if (!conversation) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/conversations/${conversation.id}/generate-prd`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setConversation(prev => prev ? {
          ...prev,
          generated_prd: data.prd,
          status: 'completed'
        } : null)
      }
    } catch (error) {
      console.error('Failed to generate PRD:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportPRD = async (format: 'markdown' | 'pdf') => {
    if (!conversation?.generated_prd) return

    try {
      const response = await fetch(`/api/conversations/${conversation.id}/export?format=${format}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${conversation.project_name || 'PRD'}.${format === 'markdown' ? 'md' : 'pdf'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export PRD:', error)
    }
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading conversation...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {conversation.project_name || 'Untitled Project'}
            </h1>
            <p className="text-sm text-gray-500">
              Status: {conversation.status}
            </p>
          </div>
          <div className="flex space-x-2">
            {conversation.status === 'in_progress' && (
              <button
                onClick={generatePRD}
                disabled={isLoading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Generating...' : 'Generate PRD'}
              </button>
            )}
            {conversation.generated_prd && (
              <>
                <button
                  onClick={() => exportPRD('markdown')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Export MD
                </button>
                <button
                  onClick={() => exportPRD('pdf')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Export PDF
                </button>
              </>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {conversation.messages.map((message) => (
          <div
            key={message.id || `${message.timestamp}-${message.role}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-900 border'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-indigo-200' : 'text-gray-500'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 border px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-6 py-4">
        <div className="flex space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            📎 Upload
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            disabled={isLoading || isTyping}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || isTyping}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
