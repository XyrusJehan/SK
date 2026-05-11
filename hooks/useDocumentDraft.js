import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for document draft management with autosave
 * Uses existing documents table
 * @param {number} barangayId - User's barangay ID
 * @param {number} userId - Current user ID
 * @param {number} debounceMs - Autosave delay in milliseconds (default: 2000)
 */
export const useDocumentDraft = (barangayId, userId, debounceMs = 2000) => {
  const [documentId, setDocumentId] = useState(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [folderCategory, setFolderCategory] = useState('planning');
  const [htmlContent, setHtmlContent] = useState('');
  const [originalFileUrl, setOriginalFileUrl] = useState('');
  const [originalFilePath, setOriginalFilePath] = useState('');
  const [status, setStatus] = useState('draft');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  const debounceTimer = useRef(null);
  const initialContent = useRef('');

  const handleContentChange = useCallback((content) => {
    setHtmlContent(content);
    setIsDirty(content !== initialContent.current);
  }, []);

  const autoSave = useCallback(async () => {
    if (!isDirty || !documentId || isSaving) return;

    setIsSaving(true);
    try {
      const { saveDraft } = require('../services/documentDraftService');
      await saveDraft(documentId, {
        title: title.trim(),
        document_type: documentType,
        folder_category: folderCategory,
        html_content: htmlContent,
      });

      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [documentId, title, documentType, folderCategory, htmlContent, isDirty, isSaving]);

  useEffect(() => {
    if (isDirty && documentId) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(autoSave, debounceMs);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [htmlContent, isDirty, documentId, autoSave, debounceMs]);

  const save = useCallback(async (submit = false) => {
    if (!title.trim()) {
      setError('Please enter a document title');
      return null;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { saveDraft, submitDocument } = require('../services/documentDraftService');

      await saveDraft(documentId, {
        title: title.trim(),
        document_type: documentType,
        folder_category: folderCategory,
        html_content: htmlContent,
        status: submit ? 'submitted' : 'draft',
      });

      if (submit) {
        await submitDocument(documentId, userId);
        setStatus('submitted');
      }

      initialContent.current = htmlContent;
      setIsDirty(false);
      setLastSaved(new Date());

      return { documentId };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [documentId, title, documentType, folderCategory, htmlContent, userId]);

  const load = useCallback(async (existingDocId) => {
    setIsLoading(true);
    setError(null);

    try {
      const { loadDocument } = require('../services/documentDraftService');
      const doc = await loadDocument(existingDocId);

      setDocumentId(doc.document_id);
      setTitle(doc.title || '');
      setDocumentType(doc.document_type || '');
      setFolderCategory(doc.folder_category || 'planning');
      setHtmlContent(doc.html_content || '');
      setOriginalFileUrl(doc.file_url || '');
      setOriginalFilePath(doc.original_file_path || '');
      setStatus(doc.status || 'draft');

      initialContent.current = doc.html_content || '';
      setIsDirty(false);
      setLastSaved(new Date(doc.updated_at));

      return doc;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFromFile = useCallback(async (fileUri, fileName) => {
    setIsLoading(true);
    setError(null);

    try {
      const { uploadDocumentFile, convertDocxToHtml, downloadDocumentFile, createDraft } = require('../services/documentDraftService');

      // Upload file
      const { url, path } = await uploadDocumentFile(fileUri, fileName, barangayId);
      setOriginalFileUrl(url);
      setOriginalFilePath(path);

      // Extract title from filename
      const cleanTitle = fileName.replace(/\.docx$/i, '').replace(/[-_]/g, ' ');
      setTitle(cleanTitle);

      // Try to convert to HTML
      let html = '';
      try {
        const blob = await downloadDocumentFile(path);
        html = await convertDocxToHtml(blob);
      } catch (e) {
        console.log('Conversion deferred:', e.message);
      }

      setHtmlContent(html);

      // Create draft in database
      const result = await createDraft({
        barangayId,
        title: cleanTitle,
        documentType: '',
        folderCategory: 'planning',
        originalFileUrl: url,
        originalFilePath: path,
        htmlContent: html,
        userId,
      });

      setDocumentId(result.documentId);
      initialContent.current = html;
      setIsDirty(true);

      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [barangayId, userId]);

  const openForEditing = useCallback(async () => {
    if (!originalFilePath) return null;

    setIsLoading(true);
    try {
      const { downloadDocumentFile, convertDocxToHtml } = require('../services/documentDraftService');

      const blob = await downloadDocumentFile(originalFilePath);
      const html = await convertDocxToHtml(blob);

      setHtmlContent(html);
      initialContent.current = html;
      setIsDirty(false);

      return html;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [originalFilePath]);

  const remove = useCallback(async (existingDocId) => {
    try {
      const { deleteDocument } = require('../services/documentDraftService');
      await deleteDocument(existingDocId);

      setDocumentId(null);
      setTitle('');
      setDocumentType('');
      setFolderCategory('planning');
      setHtmlContent('');
      setOriginalFileUrl('');
      setOriginalFilePath('');
      setStatus('draft');
      initialContent.current = '';
      setIsDirty(false);
      setLastSaved(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setDocumentId(null);
    setTitle('');
    setDocumentType('');
    setFolderCategory('planning');
    setHtmlContent('');
    setOriginalFileUrl('');
    setOriginalFilePath('');
    setStatus('draft');
    initialContent.current = '';
    setIsDirty(false);
    setLastSaved(null);
    setError(null);
  }, []);

  return {
    documentId,
    title,
    setTitle,
    documentType,
    setDocumentType,
    folderCategory,
    setFolderCategory,
    htmlContent,
    setHtmlContent: handleContentChange,
    originalFileUrl,
    originalFilePath,
    status,

    isLoading,
    isSaving,
    isDirty,
    lastSaved,
    error,

    save,
    load,
    createFromFile,
    openForEditing,
    remove,
    reset,
  };
};

/**
 * Hook for loading list of draft documents
 */
export const useDraftsList = (barangayId) => {
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadDrafts = useCallback(async (statusFilter = 'draft') => {
    if (!barangayId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { loadDrafts } = require('../services/documentDraftService');
      const data = await loadDrafts(barangayId, statusFilter);
      setDrafts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [barangayId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  return {
    drafts,
    isLoading,
    error,
    refresh: loadDrafts,
  };
};