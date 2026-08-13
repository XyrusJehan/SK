-- Migration: RLS + storage policies for compliance_documents and the 'documents' bucket
-- Run this in the Supabase SQL editor (Database -> SQL -> New query), then run the
-- storage policies section in the Storage dashboard's policies tab (or use the
-- `CREATE POLICY` statements at the bottom inside the SQL editor — both work).
--
-- Why this exists
-- ---------------
-- The app authenticates against Supabase with the anon key only (no per-user
-- Supabase Auth login). Every request — including the new Save flow that
-- inserts into compliance_documents and uploads a PDF to the 'documents'
-- Storage bucket — runs under the `anon` role.
--
-- `compliance_documents` is RLS-enabled, and there is no policy granting the
-- anon role INSERT, so the first save attempt fails with:
--   "new row violates row-level policy for table 'compliance_documents'"
--
-- The fix is to add the missing RLS policies. Because the app does its own
-- authorization (authContext.js + role check) and the database is reached
-- exclusively through the anon key, the policies below permit the anon role
-- to insert/select rows in compliance_documents and to upload/read PDFs in
-- the `documents` bucket. Tighten these later if/when Supabase Auth is
-- wired up per-user (switch the role checks to `auth.uid()` and JWT claims).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. compliance_documents  —  RLS policies
-- ───────────────────────────────────────────────────────────────────────────

-- Make sure RLS is on (it should already be, but be explicit).
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- Drop any old versions of these policies so the migration is idempotent.
DROP POLICY IF EXISTS "anon_all_compliance_documents"   ON public.compliance_documents;
DROP POLICY IF EXISTS "anon_select_compliance_documents" ON public.compliance_documents;
DROP POLICY IF EXISTS "anon_insert_compliance_documents" ON public.compliance_documents;
DROP POLICY IF EXISTS "anon_update_compliance_documents" ON public.compliance_documents;
DROP POLICY IF EXISTS "anon_delete_compliance_documents" ON public.compliance_documents;

-- All operations are permitted for the anon role. The app enforces business
-- rules (e.g. only LYDO saves here) on the client side.
CREATE POLICY "anon_all_compliance_documents"
  ON public.compliance_documents
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Equivalent fine-grained version (use this if you'd rather not grant DELETE
-- to the client; comment out the DELETE policy and uncomment the four below):
--
-- CREATE POLICY "anon_select_compliance_documents"
--   ON public.compliance_documents FOR SELECT TO anon USING (true);
--
-- CREATE POLICY "anon_insert_compliance_documents"
--   ON public.compliance_documents FOR INSERT TO anon WITH CHECK (true);
--
-- CREATE POLICY "anon_update_compliance_documents"
--   ON public.compliance_documents FOR UPDATE TO anon USING (true) WITH CHECK (true);
--
-- CREATE POLICY "anon_delete_compliance_documents"
--   ON public.compliance_documents FOR DELETE TO anon USING (true);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. storage.objects  —  policies for the 'documents' bucket
-- ───────────────────────────────────────────────────────────────────────────
-- These need to be created against `storage.objects`, filtering by
-- bucket_id = 'documents'. They let the anon role upload PDFs, overwrite
-- them, read them back, and delete them (matches the new Save flow that
-- uploads to `reports/<timestamp>_<filename>.pdf` and reads it back via
-- public URL).
--
-- Run each block separately if your Supabase project has the legacy
-- per-bucket policy UI — these are the table-level equivalents.

DROP POLICY IF EXISTS "anon_select_documents_bucket"   ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_documents_bucket"   ON storage.objects;
DROP POLICY IF EXISTS "anon_update_documents_bucket"   ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_documents_bucket"   ON storage.objects;

CREATE POLICY "anon_select_documents_bucket"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'documents');

CREATE POLICY "anon_insert_documents_bucket"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "anon_update_documents_bucket"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "anon_delete_documents_bucket"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (bucket_id = 'documents');

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Make the 'documents' bucket public so getPublicUrl() returns a URL
--    the browser can open without a signed token. (Already true for the
--    existing 'reports' bucket; switch this if you prefer to keep the
--    bucket private and use createSignedUrl() in reportPdf.js instead.)
-- ───────────────────────────────────────────────────────────────────────────
-- If the bucket already exists, this is a no-op (it's idempotent thanks to
-- the WHERE NOT EXISTS guard that some Supabase versions wrap it in, but
-- if you get "bucket already exists", just skip this statement.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
