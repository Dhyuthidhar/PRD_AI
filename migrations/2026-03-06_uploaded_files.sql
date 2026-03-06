-- Create uploaded_files table for file upload functionality
-- This tracks uploaded documents and their metadata

CREATE TABLE uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for better performance
CREATE INDEX idx_uploaded_files_conversation_id ON uploaded_files(conversation_id);

-- Comment
COMMENT ON TABLE uploaded_files IS 'Stores metadata for uploaded files in conversations';
COMMENT ON COLUMN uploaded_files.conversation_id IS 'Reference to the conversation this file belongs to';
COMMENT ON COLUMN uploaded_files.filename IS 'Original filename of the uploaded file';
COMMENT ON COLUMN uploaded_files.file_type IS 'MIME type of the uploaded file';
COMMENT ON COLUMN uploaded_files.file_size IS 'Size of the uploaded file in bytes';
COMMENT ON COLUMN uploaded_files.storage_path IS 'Path in Supabase Storage where the file is stored';
COMMENT ON COLUMN uploaded_files.uploaded_at IS 'When the file was uploaded';