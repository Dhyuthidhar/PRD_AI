'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getStageLabel } from '@/lib/conversationStages'
import { marked } from 'marked'

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
  current_stage?: number
  stage_data?: Record<string, number>
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
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [prdHtml, setPrdHtml] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const stripCodeFences = (content: string): string => {
    // Remove opening fence: ```markdown, ```md, ``` (with optional language)
    // Remove closing fence: ```
    // Also remove "In Markdown format:" prefix lines
    return content
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/^```$/gm, '')
      .replace(/^In Markdown format:\s*\n?/gim, '')
      .trim()
  }

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (!mounted) return
      
      if (conversationId) {
        await loadConversation(conversationId)
      } else if (!isCreatingNew && !conversation) {
        setIsCreatingNew(true)
        await startNewConversation()
      }
    }
    
    load()
    
    return () => { mounted = false }
  }, [conversationId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation?.messages?.length])

  useEffect(() => {
    if (conversation?.generated_prd) {
      const result = marked.parse(conversation.generated_prd)
      if (result instanceof Promise) {
        result.then((html: string) => setPrdHtml(html))
      } else {
        setPrdHtml(result)
      }
    } else {
      setPrdHtml('')
    }
  }, [conversation?.generated_prd])

  const saveConversationName = async () => {
    if (!conversation || !editingName.trim()) return
    
    const newName = editingName.trim()
    if (newName.length < 1 || newName.length > 100) {
      setNameError('Name must be between 1 and 100 characters')
      return
    }
    
    setIsSavingName(true)
    setNameError('')
    
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: newName })
      })
      
      if (response.ok) {
        setConversation(prev => prev ? { ...prev, project_name: newName } : null)
        setIsEditingName(false)
        document.title = `${newName} - AI PRD Assistant`
      } else {
        throw new Error('Failed to update name')
      }
    } catch (error) {
      setNameError('Failed to save name')
      setEditingName(conversation.project_name)
    } finally {
      setIsSavingName(false)
    }
  }

  const startEditingName = () => {
    if (!conversation) return
    setEditingName(conversation.project_name)
    setIsEditingName(true)
    setNameError('')
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveConversationName()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
      setNameError('')
    }
  }

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const conversation = data.conversation || data
        setConversation(conversation)
        document.title = `${conversation.project_name} - AI PRD Assistant`
        
        // Update stage state from API response
        if (conversation.current_stage !== undefined) {
          setCurrentStage(conversation.current_stage)
          setStageName(getStageLabel(conversation.current_stage))
          setStageProgress(Math.round((conversation.current_stage / 7) * 100))
        }
      } else if (response.status === 401) {
        window.location.href = '/login'
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
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const conversation = data.conversation || data
        setConversation(conversation)
        document.title = `${conversation.project_name} - AI PRD Assistant`
        router.replace(`/conversation/${conversation.id}`)
      } else if (response.status === 401) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Failed to start new conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || isTyping || !conversation) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    }

    setConversation(prev => prev ? {
      ...prev,
      messages: [...(prev.messages || []), userMessage]
    } : null)

    setInputMessage('')
    setIsLoading(true)
    setIsTyping(true)

    try {
      await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage)
      })

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          message: userMessage.content
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: data.response,
          timestamp: new Date().toISOString()
        }

        await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiMessage)
        })

        setConversation(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), aiMessage]
        } : null)

        // Update stage progress if API returned new stage info
        if (data.current_stage !== undefined) {
          setCurrentStage(data.current_stage)
          setStageName(getStageLabel(data.current_stage))
          setStageProgress(Math.round((data.current_stage / 7) * 100))
        }
      } else if (response.status === 401) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const generatePRD = async () => {
    if (!conversation || isLoading) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/generate-prd`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setConversation(prev => prev ? {
          ...prev,
          generated_prd: data.prd,
          status: 'completed'
        } : null)

        // Update stage progress to 100% when PRD is generated
        setCurrentStage(7)
        setStageName('PRD Ready')
        setStageProgress(100)
      } else if (response.status === 401) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Failed to generate PRD:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportPRD = async (format: 'markdown' | 'pdf') => {
    if (!conversation) return

    setIsExporting(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/export?format=${format}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${conversation.project_name || 'PRD'}.${format === 'pdf' ? 'pdf' : 'md'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export PRD:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversation) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        
        const fileMessage = {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: `I've received your file "${file.name}". Let me analyze it...`,
          timestamp: new Date().toISOString()
        }

        setConversation(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), fileMessage]
        } : null)

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
            content: `I've analyzed your document "${data.file.filename}". Here's what I found:\n\n${processData.analysis}`,
            timestamp: new Date().toISOString()
          }

          await fetch(`/api/conversations/${conversation.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analysisMessage)
          })

          setConversation(prev => prev ? {
            ...prev,
            messages: [...(prev.messages || []), analysisMessage]
          } : null)

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

                await fetch(`/api/conversations/${conversation.id}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(followUpMessage)
                })

                setConversation(prev => prev ? {
                  ...prev,
                  messages: [...(prev.messages || []), followUpMessage]
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
    }
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="skeleton h-4 w-32 rounded"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Left Panel - Chat */}
      <div className="flex flex-col w-1/2 border-r border-gray-200 overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    onBlur={saveConversationName}
                    className="text-xl font-semibold border-b-2 border-indigo-500 outline-none px-1"
                    style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
                    placeholder="Project name"
                    maxLength={100}
                  />
                  {isSavingName && (
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 
                    className="text-xl font-semibold cursor-pointer hover:text-indigo-600"
                    style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
                    onDoubleClick={startEditingName}
                    title="Double-click to edit"
                  >
                    {conversation.project_name || 'Untitled Project'}
                  </h1>
                  <button
                    onClick={startEditingName}
                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Edit project name"
                  >
                    ✏️
                  </button>
                </div>
              )}
              {nameError && (
                <span className="text-red-500 text-sm">{nameError}</span>
              )}
            </div>
            <div className="flex space-x-2">
              {conversation.status === 'in_progress' && (
                <button
                  onClick={generatePRD}
                  disabled={isLoading || currentStage < 7}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    currentStage < 7
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'button-primary'
                  }`}
                  title={currentStage < 7 ? `Complete all discovery stages first (${stageName} in progress)` : 'Generate PRD'}
                >
                  {isLoading ? 'Generating...' : 'Generate PRD'}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  router.push('/dashboard')
                }}
                className="button-secondary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        {/* Stage Progress */}
        {conversation.status === 'in_progress' && (
          <div className="px-6 py-4 bg-white border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                Discovery Progress
              </h3>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {stageProgress}%
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    step <= currentStage
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step < currentStage ? '✓' : step}
                  </div>
                  {step < 7 && (
                    <div className={`w-8 h-1 ${
                      step < currentStage ? 'bg-indigo-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Current: {stageName}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4 custom-scrollbar" style={{ background: 'var(--color-surface)' }}>
          {Array.isArray(conversation.messages) && conversation.messages.length > 0 ? (
            (() => {
              // Deduplicate messages
              const seen = new Set<string>()
              const deduped = conversation.messages.filter(msg => {
                const key = `${msg.role}:${msg.content.slice(0, 50)}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
              })
              
              return deduped.map((message) => (
                <div
                  key={message.id || message.timestamp}
                  className={`flex mb-4 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    ) : (
                      <div 
                        className="text-sm text-gray-800 leading-relaxed
                                   [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h1]:mb-2 [&_h1]:mt-3
                                   [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-1 [&_h2]:mt-3
                                   [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-700 [&_h3]:mb-1 [&_h3]:mt-2
                                   [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:text-gray-600 [&_h4]:mb-1 [&_h4]:mt-2
                                   [&_p]:mb-2 [&_p]:last:mb-0
                                   [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:list-disc
                                   [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal
                                   [&_li]:mb-0.5
                                   [&_strong]:font-semibold [&_strong]:text-gray-900
                                   [&_a]:text-indigo-600 [&_a]:underline
                                   [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
                        dangerouslySetInnerHTML={{ 
                          __html: marked.parse(stripCodeFences(message.content)) as string 
                        }}
                      />
                    )}
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                    }`}>
                      {message.timestamp 
                        ? new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit'
                          }) 
                        : ''}
                    </p>
                  </div>
                </div>
              ))
            })()
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              No messages yet
            </div>
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-end space-x-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
                <div className="bg-white border px-4 py-3 rounded-2xl rounded-bl-4" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
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
              className="button-secondary px-3"
            >
              📎
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              disabled={isLoading || isTyping}
              className="input-field flex-1"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || isTyping}
              className="button-primary px-4"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - PRD Preview */}
      <div className="flex flex-col w-1/2 overflow-hidden min-w-0" style={{ background: 'var(--color-surface-2)' }}>
        {/* Header */}
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
              PRD Preview
            </h2>
            {conversation.generated_prd && (
              <div className="flex space-x-2">
                <button
                  onClick={() => exportPRD('markdown')}
                  disabled={isExporting}
                  className="button-secondary px-3 py-2 text-sm flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  MD
                </button>
                <button
                  onClick={() => exportPRD('pdf')}
                  disabled={isExporting}
                  className="button-secondary px-3 py-2 text-sm flex items-center space-x-1"
                >
                  <svg className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {prdHtml ? (
            <div className="prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: prdHtml }} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                PRD Not Generated Yet
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Your PRD will appear here as the conversation progresses
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
