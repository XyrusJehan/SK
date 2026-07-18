-- Migration: Add foreign key references to documents table
-- This script adds new columns for category_id, document_type_id, and folder_year_id
-- to connect the documents table to the new reference tables

-- 1. Add new columns to documents table (nullable first, will populate data)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS category_id bigint REFERENCES document_category(id),
ADD COLUMN IF NOT EXISTS document_type_id bigint REFERENCES document_types(id),
ADD COLUMN IF NOT EXISTS folder_year_id bigint REFERENCES folder_year(id);

-- 2. Create indexes for the new foreign key columns
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON public.documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_year_id ON public.documents(folder_year_id);

-- 3. Populate the foreign key columns from existing data
-- First, update category_id based on folder_category values
UPDATE public.documents d
SET category_id = dc.id
FROM public.document_category dc
WHERE LOWER(dc.document_category) = LOWER(d.folder_category);

-- 4. Populate folder_year_id based on year values (fiscal_year is integer in your format)
UPDATE public.documents d
SET folder_year_id = fy.id
FROM public.folder_year fy
WHERE fy.fiscal_year = d.year;

-- 5. Populate document_type_id based on document_type values
-- This maps the old string values to the new document_types table IDs
UPDATE public.documents d
SET document_type_id = dt.id
FROM public.document_types dt
WHERE dt.document_type = d.document_type
   OR dt.document_type LIKE d.document_type || ' %'
   OR dt.document_type LIKE '% ' || d.document_type;

-- If the above doesn't match all, also try matching by similar names
-- This is a fallback for variations in naming
UPDATE public.documents d
SET document_type_id = dt.id
FROM public.document_types dt
WHERE d.document_type_id IS NULL
  AND (LOWER(dt.document_type) LIKE '%' || LOWER(d.document_type) || '%'
       OR LOWER(d.document_type) LIKE '%' || LOWER(dt.document_type) || '%');

-- Note: Your reference tables already have data:
-- folder_year: id=1, fiscal_year=2026
-- document_category: id 1-4 (Planning, Financial, Governance, Performance)
-- document_types: id 1-17 with category references to document_category.id