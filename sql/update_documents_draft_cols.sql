-- Add columns for DOCX draft editing support
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS html_content TEXT,
ADD COLUMN IF NOT EXISTS original_file_path TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_draft_status ON documents(status) WHERE status = 'draft';