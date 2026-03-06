-- Add analysis field to uploaded_files table for persisting document analysis
-- This enables document context to be reused in subsequent chat messages

ALTER TABLE uploaded_files 
ADD COLUMN analysis TEXT,
ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on analysis
CREATE INDEX idx_uploaded_files_conversation_analysis ON uploaded_files(conversation_id) WHERE analysis IS NOT NULL;

-- Comment
COMMENT ON COLUMN uploaded_files.analysis IS 'AI-generated analysis of the document content for context in conversations';
COMMENT ON COLUMN uploaded_files.processed_at IS 'When the document was processed by AI';