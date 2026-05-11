import { supabase } from '../utils/supabase';

/**
 * Document Draft Service
 * Handles file storage, DOCX conversion, and draft management
 * Uses existing documents and document_versions tables
 */

// Storage bucket name
const STORAGE_BUCKET = 'documents';

/**
 * Upload a DOCX file to Supabase Storage
 * @param {string} fileUri - Local file URI
 * @param {string} fileName - Original file name
 * @param {string} barangayId - User's barangay ID
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadDocumentFile = async (fileUri, fileName, barangayId) => {
  try {
    const timestamp = Date.now();
    const cleanName = fileName.replace(/\.docx$/i, '');
    const storagePath = `${barangayId}/uploads/${timestamp}_${cleanName}.docx`;

    const response = await fetch(fileUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, blob, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return { url: publicUrl, path: data.path };
  } catch (error) {
    console.error('Error uploading document:', error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }
};

/**
 * Download a file from Supabase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<Blob>}
 */
export const downloadDocumentFile = async (storagePath) => {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error downloading document:', error);
    throw new Error(`Failed to download document: ${error.message}`);
  }
};

/**
 * Convert DOCX to HTML using docx-parser
 * @param {Blob} docxBlob - DOCX file blob
 * @returns {Promise<string>} HTML content
 */
export const convertDocxToHtml = async (docxBlob) => {
  try {
    const docxParser = require('docx-parser');
    const arrayBuffer = await docxBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
      docxParser.parseDocx(buffer, (err, data) => {
        if (err) {
          console.error('Error parsing DOCX:', err);
          // Fallback: return empty content
          resolve('');
        } else {
          // Convert parsed data to HTML
          const paragraphs = data.split('\n').filter(p => p.trim());
          const html = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
          resolve(html || '<p></p>');
        }
      });
    });
  } catch (error) {
    console.error('Error converting DOCX to HTML:', error);
    // Return empty content - user can type manually
    return '';
  }
};

// Helper to escape HTML characters
const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

/**
 * Create a new document draft
 * @param {object} draftData - Draft data object
 * @returns {Promise<{documentId: number, versionId: number}>}
 */
export const createDraft = async ({
  barangayId,
  title,
  documentType,
  folderCategory,
  originalFileUrl,
  originalFilePath,
  htmlContent,
  userId,
}) => {
  try {
    const now = new Date().toISOString();

    // Create document with draft status
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        barangay_id: barangayId,
        submitted_by: userId,
        title: title.trim(),
        document_type: documentType,
        folder_category: folderCategory,
        status: 'draft',
        current_version: 1,
        year: new Date().getFullYear(),
        html_content: htmlContent,
        original_file_path: originalFilePath,
        is_draft_edit: true,
        created_at: now,
      })
      .select('document_id')
      .single();

    if (docError) throw docError;

    // Create initial version
    const { data: versionData, error: versionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: docData.document_id,
        version_number: 1,
        file_url: originalFileUrl,
        action: 'submitted',
        actioned_by: userId,
        created_at: now,
      })
      .select('version_id')
      .single();

    if (versionError) throw versionError;

    return { documentId: docData.document_id, versionId: versionData.version_id };
  } catch (error) {
    console.error('Error creating draft:', error);
    throw new Error(`Failed to create draft: ${error.message}`);
  }
};

/**
 * Save/update a document draft
 * @param {number} documentId - Document ID
 * @param {object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const saveDraft = async (documentId, updates) => {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('documents')
      .update({
        ...updates,
        saved_at: now,
        updated_at: now,
      })
      .eq('document_id', documentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw new Error(`Failed to save draft: ${error.message}`);
  }
};

/**
 * Save document version when submitting
 * @param {number} documentId - Document ID
 * @param {object} versionData - Version data
 * @returns {Promise<number>} version_id
 */
export const saveDocumentVersion = async (documentId, versionData) => {
  try {
    // Get current version number
    const { data: doc } = await supabase
      .from('documents')
      .select('current_version')
      .eq('document_id', documentId)
      .single();

    const newVersion = (doc?.current_version || 0) + 1;

    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: newVersion,
        file_url: versionData.file_url,
        action: versionData.action || 'submitted',
        actioned_by: versionData.actioned_by,
      })
      .select('version_id')
      .single();

    if (error) throw error;

    // Update document current_version
    await supabase
      .from('documents')
      .update({ current_version: newVersion })
      .eq('document_id', documentId);

    return data.version_id;
  } catch (error) {
    console.error('Error saving version:', error);
    throw new Error(`Failed to save version: ${error.message}`);
  }
};

/**
 * Load an existing document for editing
 * @param {number} documentId - Document ID
 * @returns {Promise<object>} Document data with versions
 */
export const loadDocument = async (documentId) => {
  try {
    // Load document
    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (error) throw error;

    // Load versions
    const { data: versions } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });

    return { ...doc, versions: versions || [] };
  } catch (error) {
    console.error('Error loading document:', error);
    throw new Error(`Failed to load document: ${error.message}`);
  }
};

/**
 * Load all drafts for a barangay
 * @param {number} barangayId - Barangay ID
 * @param {string} status - Optional status filter
 * @returns {Promise array} Documents array
 */
export const loadDrafts = async (barangayId, status = 'draft') => {
  try {
    let query = supabase
      .from('documents')
      .select('*, document_versions(version_id, file_url, created_at)')
      .eq('barangay_id', barangayId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error loading drafts:', error);
    throw new Error(`Failed to load drafts: ${error.message}`);
  }
};

/**
 * Delete a document (only if draft)
 * @param {number} documentId - Document ID
 * @returns {Promise<void>}
 */
export const deleteDocument = async (documentId) => {
  try {
    // Check if draft
    const { data: doc } = await supabase
      .from('documents')
      .select('status')
      .eq('document_id', documentId)
      .single();

    if (doc?.status !== 'draft') {
      throw new Error('Can only delete draft documents');
    }

    // Delete versions first
    await supabase
      .from('document_versions')
      .delete()
      .eq('document_id', documentId);

    // Delete document
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('document_id', documentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};

/**
 * Submit document for review (change status to submitted)
 * @param {number} documentId - Document ID
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 */
export const submitDocument = async (documentId, userId) => {
  try {
    const now = new Date().toISOString();

    // Get current document
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('document_id', documentId)
      .single();

    // Save new version
    await saveDocumentVersion(documentId, {
      file_url: doc.original_file_path,
      action: 'submitted',
      actioned_by: userId,
    });

    // Update document status
    const { error } = await supabase
      .from('documents')
      .update({
        status: 'submitted',
        submitted_at: now,
        is_draft_edit: false,
        updated_at: now,
      })
      .eq('document_id', documentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error submitting document:', error);
    throw new Error(`Failed to submit document: ${error.message}`);
  }
};

/**
 * Finalize document - submit and mark as approved
 * @param {number} documentId - Document ID
 * @param {number} userId - User ID (LYDO)
 * @returns {Promise<void>}
 */
export const finalizeDocument = async (documentId, userId) => {
  try {
    const now = new Date().toISOString();

    // Save version as approved
    await saveDocumentVersion(documentId, {
      action: 'approved',
      actioned_by: userId,
    });

    // Update document status
    const { error } = await supabase
      .from('documents')
      .update({
        status: 'approved',
        reviewed_at: now,
        is_draft_edit: false,
      })
      .eq('document_id', documentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error finalizing document:', error);
    throw new Error(`Failed to finalize document: ${error.message}`);
  }
};

/**
 * Export HTML content (placeholder for DOCX export)
 * For full DOCX export, server-side processing recommended
 * @param {string} htmlContent - HTML content
 * @returns {string} HTML for export
 */
export const exportToHtml = (htmlContent) => {
  return htmlContent;
};