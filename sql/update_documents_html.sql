-- Add html_content column to documents table for draft editing
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS html_content TEXT;

-- Add original_file_path for storing DOCX in Supabase Storage
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS original_file_path TEXT;

-- Add is_draft_editing flag to track draft state
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS is_draft_edit BOOLEAN DEFAULT FALSE;

-- Create index for faster draft queries
CREATE INDEX IF NOT EXISTS idx_documents_is_draft_edit ON documents(is_draft_edit);

-- Enable RLS on new columns (inherits from documents table)
-- Already has RLS enabled on documents table 