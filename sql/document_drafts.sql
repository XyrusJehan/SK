-- Document Drafts Table
-- Stores draft documents with editable HTML content

CREATE TABLE IF NOT EXISTS document_drafts (
  draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay_id UUID REFERENCES barangays(barangay_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  document_type VARCHAR(100),
  folder_category VARCHAR(50) DEFAULT 'planning',
  original_file_url TEXT,
  original_file_path TEXT,
  html_content TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'finalized', 'archived')),
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_document_drafts_barangay ON document_drafts(barangay_id);
CREATE INDEX IF NOT EXISTS idx_document_drafts_status ON document_drafts(status);
CREATE INDEX IF NOT EXISTS idx_document_drafts_updated ON document_drafts(updated_at DESC);

-- Enable RLS
ALTER TABLE document_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view drafts for their barangay"
  ON document_drafts FOR SELECT
  USING (barangay_id IN (
    SELECT barangay_id FROM users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create drafts for their barangay"
  ON document_drafts FOR INSERT
  WITH CHECK (
    barangay_id IN (
      SELECT barangay_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own drafts"
  ON document_drafts FOR UPDATE
  USING (
    created_by = auth.uid() OR
    barangay_id IN (
      SELECT barangay_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own drafts"
  ON document_drafts FOR DELETE
  USING (created_by = auth.uid());

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_drafts_updated_at
  BEFORE UPDATE ON document_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE document_drafts IS 'Stores draft documents with editable HTML content';
COMMENT ON COLUMN document_drafts.html_content IS 'HTML content for rich text editing';
COMMENT ON COLUMN document_drafts.original_file_url IS 'URL to original uploaded DOCX file in Supabase Storage';