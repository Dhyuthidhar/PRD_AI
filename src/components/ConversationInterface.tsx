'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getStageLabel } from '@/lib/conversationStages'

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
  const [currentStage, setCurrentStage] = useState(0)
  const [stageName, setStageName] = useState('Initial Assessment')
  const [stageProgress, setStageProgress] = useState(0)
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
        // Initialize stage from conversation object
        setCurrentStage(data.conversation.current_stage || 0)
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
    try {
      // Call /api/chat with __INIT__ trigger to get stage 0 ASSESS prompt response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          message: '__INIT__'
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

        // Save AI message
        await fetch(`/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiMessage)
        })

        // Update conversation with AI message
        setConversation(prev => prev ? {
          ...prev,
          messages: [...prev.messages, aiMessage]
        } : null)
      }
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

        // Update stage state after each chat API response
        if (data.currentStage !== undefined) {
          setCurrentStage(data.currentStage)
          setStageName(data.stageName)
          setStageProgress(data.stageProgress)
        }

        // Show warning if stage save failed
        if (data.warning) {
          console.warn('Stage save warning:', data.warning)
          // Could add a toast notification here in the future
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
          
          // Add the document analysis as an assistant message
          const analysisMessage = {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: `I've analyzed your document "${data.file.filename}". Here's what I found:\n\n${processData.analysis}`,
            timestamp: new Date().toISOString()
          }

          // Save the analysis message first
          await fetch(`/api/conversations/${conversation.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analysisMessage)
          })

          // Update conversation with analysis
          setConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, analysisMessage]
          } : null)

          // Now trigger AI to ask follow-up questions based on the document
          setIsTyping(true)
          setTimeout(async () => {
            try {
              const followUpResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  conversationId: conversation.id,
                  message: "Based on the document I just uploaded, what follow-up questions do you have to help me refine my requirements?"
                })
              })

              if (followUpResponse.ok) {
                const followUpData = await followUpResponse.json()
                const followUpMessage = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant' as const,
                  content: followUpData.response,
                  timestamp: new Date().toISOString()
                }

                // Save the follow-up message
                await fetch(`/api/conversations/${conversation.id}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(followUpMessage)
                })

                setConversation(prev => prev ? {
                  ...prev,
                  messages: [...prev.messages, followUpMessage]
                } : null)
              }
            } catch (error) {
              console.error('Failed to get follow-up response:', error)
            } finally {
              setIsTyping(false)
            }
          }, 500)
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
        
        // Update stage to completion
        setCurrentStage(7)
        setStageName('PRD Ready')
        setStageProgress(100)
      } else {
        // Handle readiness check failure
        const errorData = await response.json()
        if (response.status === 400 && errorData.missingCritical) {
          // Show user what's missing instead of generic error
          const errorMessage = `${errorData.message}\n\nMissing information:\n${errorData.missingCritical.map((item: string) => `• ${item}`).join('\n')}\n\nFocus on: ${errorData.nextFocus}`
          
          // Add AI message explaining what's needed
          const guidanceMessage = {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: `I need more information before generating a comprehensive PRD. Let me help you gather what's missing.

${errorData.message}

**What we still need to explore:**
${errorData.missingCritical.map((item: string) => `• ${item}`).join('\n')}

**Let's focus on:** ${errorData.nextFocus}

Could you tell me more about ${errorData.nextFocus}?`,
            timestamp: new Date().toISOString()
          }

          // Update stage from error response (if available)
          if (errorData.currentStage !== undefined) {
            setCurrentStage(errorData.currentStage)
            setStageName(errorData.stageName || getStageLabel(errorData.currentStage))
            setStageProgress(errorData.stageProgress || Math.round((errorData.currentStage / 7) * 100))
          }

          setConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, guidanceMessage]
          } : null)
        } else {
          console.error('Failed to generate PRD:', errorData)
        }
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
                disabled={isLoading || currentStage < 7}
                className={`px-4 py-2 rounded-md ${
                  currentStage < 7
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                }`}
                title={currentStage < 7 ? `Complete all discovery stages first (${stageName} in progress)` : 'Generate PRD'}
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

      {/* Stage Progress Indicator */}
      {conversation.status === 'in_progress' && (
        <div className="px-6 py-2">
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Discovery Progress</h3>
              <span className="text-sm text-gray-600">{stageProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Current Stage: </span>
              <span>{stageName}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Assessment → Overview → Users → Features → Technical → UI/UX → Confirm → Ready
            </div>
          </div>
        </div>
      )}

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
