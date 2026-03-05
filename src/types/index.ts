export interface User {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  project_name: string
  status: 'in_progress' | 'completed'
  created_at: string
  last_modified: string
  messages: Message[]
  generated_prd?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  images?: string[]
}

export interface UploadedFile {
  id: string
  conversation_id: string
  filename: string
  file_type: string
  file_size: number
  storage_path: string
  uploaded_at: string
}

export interface PRDSection {
  title: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface PRDDocument {
  project_name: string
  date: string
  overview: string
  target_users: string
  features: string
  technical_requirements: string
  ui_ux_requirements: string
  open_questions: string
}
