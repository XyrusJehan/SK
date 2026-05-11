import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';

const COLORS = {
  navy: '#133E75',
  gold: '#E8C547',
  white: '#FFFFFF',
  offWhite: '#F7F5F2',
  lightGray: '#ECECEC',
  midGray: '#B0B0B0',
  darkText: '#1A1A1A',
  subText: '#666666',
  red: '#D32F2F',
  blue: '#1565C0',
  green: '#2E7D32',
};

const DOCUMENT_TYPES = [
  'Resolution',
  'Ordinance',
  'Minutes',
  'Budget',
  'Report',
  'Memo',
  'Letter',
  'Work Plans',
  'ABYIP',
  'CBYDP',
  'Project Proposal',
  'Other',
];

const FOLDER_CATEGORIES = [
  { value: 'planning', label: 'Planning' },
  { value: 'financial', label: 'Financial' },
  { value: 'governance', label: 'Governance' },
  { value: 'performance', label: 'Performance' },
];

const HTML_EDITOR_TEMPLATE = (content, placeholder) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      padding: 16px;
      padding-bottom: 80px;
      background: #fff;
      color: #1A1A1A;
    }
    #editor {
      min-height: 400px;
      outline: none;
      padding: 12px;
      border: 1px solid #ECECEC;
      border-radius: 8px;
    }
    #editor:empty:before {
      content: '${placeholder}';
      color: #B0B0B0;
    }
    #editor p { margin-bottom: 12px; }
    #editor h1, #editor h2, #editor h3 { margin: 16px 0 8px; color: #133E75; }
    #editor ul, #editor ol { margin-left: 20px; margin-bottom: 12px; }
    #editor li { margin-bottom: 4px; }
    #editor b, #editor strong { font-weight: 700; }
    #editor i, #editor em { font-style: italic; }
    #editor u { text-decoration: underline; }
    #editor blockquote {
      border-left: 4px solid #E8C547;
      padding-left: 12px;
      margin: 12px 0;
      color: #666;
    }
    #editor table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    #editor th, #editor td {
      border: 1px solid #ECECEC;
      padding: 8px;
      text-align: left;
    }
    #editor th { background: #F7F5F2; }
    .toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      border-top: 1px solid #ECECEC;
      padding: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      justify-content: center;
      z-index: 100;
    }
    .toolbar button {
      padding: 10px 14px;
      border: 1px solid #ECECEC;
      border-radius: 6px;
      background: #F7F5F2;
      font-size: 14px;
      cursor: pointer;
      min-width: 40px;
    }
    .toolbar button:active { background: #E8C547; }
  </style>
</head>
<body>
  <div id="editor" contenteditable="true">${content}</div>
  <div class="toolbar">
    <button onclick="format('bold')"><b>B</b></button>
    <button onclick="format('italic')"><i>I</i></button>
    <button onclick="format('underline')"><u>U</u></button>
    <button onclick="format('insertUnorderedList')">• List</button>
    <button onclick="format('insertOrderedList')">1. List</button>
    <button onclick="format('formatBlock', 'h2')">Heading</button>
    <button onclick="format('formatBlock', 'blockquote')">Quote</button>
  </div>
  <script>
    const editor = document.getElementById('editor');

    editor.addEventListener('input', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'content',
        html: editor.innerHTML
      }));
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
      }
    });

    function format(command, value) {
      if (value) {
        document.execCommand(command, false, value);
      } else {
        document.execCommand(command);
      }
      editor.focus();
    }

    window.getContent = () => editor.innerHTML;
    window.setContent = (html) => editor.innerHTML = html;
  </script>
</body>
</html>
`;

export default function DocumentEditor({
  visible,
  onClose,
  editData,
  onSave,
  barangayId,
  userId,
}) {
  console.log('DocumentEditor rendered, visible:', visible, 'editData:', editData);

  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [folderCategory, setFolderCategory] = useState('planning');
  const [htmlContent, setHtmlContent] = useState('');
  const [originalFileUrl, setOriginalFileUrl] = useState('');
  const [originalFilePath, setOriginalFilePath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const webViewRef = useRef(null);

  useEffect(() => {
    const loadExistingDocument = async () => {
      if (!visible) return;

      try {
        if (editData?.documentId) {
          setTitle(editData.title || '');
          setDocumentType(editData.documentType || '');
          setFolderCategory(editData.folderCategory || 'planning');
          setOriginalFileUrl(editData.originalFileUrl || '');
          setOriginalFilePath(editData.originalFilePath || '');

          // If we have html_content, use it
          if (editData.htmlContent) {
            setHtmlContent(editData.htmlContent);
          } else if (editData.originalFilePath) {
            // No html_content but has original file - convert it
            setIsLoading(true);
            try {
              const { downloadDocumentFile, convertDocxToHtml } = require('../services/documentDraftService');
              const blob = await downloadDocumentFile(editData.originalFilePath);
              const html = await convertDocxToHtml(blob);
              setHtmlContent(html);
            } catch (e) {
              console.log('Could not convert existing file:', e.message);
              setHtmlContent('');
            } finally {
              setIsLoading(false);
            }
          } else {
            setHtmlContent('');
          }
        } else {
          setTitle('');
          setDocumentType('');
          setFolderCategory('planning');
          setHtmlContent('');
          setOriginalFileUrl('');
          setOriginalFilePath('');
        }
      } catch (error) {
        console.error('Error in loadExistingDocument:', error);
      }
    };

    loadExistingDocument();
  }, [editData, visible]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'content') {
        setHtmlContent(data.html);
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setIsLoading(true);

        const { uploadDocumentFile, downloadDocumentFile, convertDocxToHtml } = require('../services/documentDraftService');

        const { url, path } = await uploadDocumentFile(file.uri, file.name, barangayId);
        setOriginalFileUrl(url);
        setOriginalFilePath(path);

        const cleanTitle = file.name.replace(/\.docx$/i, '').replace(/[-_]/g, ' ');
        setTitle(cleanTitle);

        try {
          const blob = await downloadDocumentFile(path);
          const html = await convertDocxToHtml(blob);
          setHtmlContent(html);
        } catch (e) {
          console.log('Will convert on save:', e.message);
        }

        setIsLoading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a document title');
      return;
    }

    setIsLoading(true);
    try {
      const { saveDraft, createDraft } = require('../services/documentDraftService');

      if (editData?.documentId) {
        await saveDraft(editData.documentId, {
          title: title.trim(),
          document_type: documentType,
          folder_category: folderCategory,
          html_content: htmlContent,
          original_file_path: originalFilePath,
        });
      } else {
        const result = await createDraft({
          barangayId,
          title: title.trim(),
          documentType,
          folderCategory,
          originalFileUrl,
          originalFilePath,
          htmlContent,
          userId,
        });
        onSave?.(result);
      }

      Alert.alert('Success', 'Document saved as draft');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save draft: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a document title');
      return;
    }

    setIsLoading(true);
    try {
      const { createDraft, submitDocument, saveDraft } = require('../services/documentDraftService');

      let docId = editData?.documentId;

      if (!docId) {
        const result = await createDraft({
          barangayId,
          title: title.trim(),
          documentType,
          folderCategory,
          originalFileUrl,
          originalFilePath,
          htmlContent,
          userId,
        });
        docId = result.documentId;
      } else {
        await saveDraft(docId, {
          title: title.trim(),
          document_type: documentType,
          folder_category: folderCategory,
          html_content: htmlContent,
        });
      }

      await submitDocument(docId, userId);

      Alert.alert('Success', 'Document submitted for review');
      onSave?.({ documentId: docId });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getWebViewHtml = () => {
    return HTML_EDITOR_TEMPLATE(htmlContent, 'Start typing your document here...');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      style={styles.modal}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editData ? 'Edit Document' : 'New Document'}
          </Text>
          <TouchableOpacity
            onPress={() => setShowActions(true)}
            style={styles.menuBtn}
          >
            <Text style={styles.menuBtnText}>⋮</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter document title"
            placeholderTextColor={COLORS.midGray}
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Type</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowTypePicker(true)}
              >
                <Text style={[styles.pickerText, !documentType && styles.placeholder]}>
                  {documentType || 'Select type'}
                </Text>
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {FOLDER_CATEGORIES.find(c => c.value === folderCategory)?.label || 'Select'}
                </Text>
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!htmlContent && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickDocument}
            disabled={isLoading}
          >
            <Text style={styles.uploadBtnIcon}>📄</Text>
            <Text style={styles.uploadBtnText}>Upload DOCX</Text>
            <Text style={styles.uploadBtnSub}>or start typing below</Text>
          </TouchableOpacity>
        )}

        {htmlContent ? (
          <View style={styles.editorContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: getWebViewHtml() }}
              onMessage={handleWebViewMessage}
              style={styles.webView}
              showsVerticalScrollIndicator={false}
              bounces={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        ) : (
          <View style={styles.emptyEditor}>
            <Text style={styles.emptyEditorText}>
              Upload a DOCX file or start typing below
            </Text>
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.navy} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.draftBtn]}
            onPress={handleSaveDraft}
            disabled={isLoading}
          >
            <Text style={styles.draftBtnText}>Save as Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.submitBtn]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitBtnText}>Submit</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showTypePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTypePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowTypePicker(false)}
          >
            <View style={styles.pickerModal}>
              <Text style={styles.pickerTitle}>Select Document Type</Text>
              <ScrollView>
                {DOCUMENT_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerItem,
                      documentType === type && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setDocumentType(type);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      documentType === type && styles.pickerItemTextActive,
                    ]}>
                      {type}
                    </Text>
                    {documentType === type && (
                      <Text style={styles.check}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowCategoryPicker(false)}
          >
            <View style={styles.pickerModal}>
              <Text style={styles.pickerTitle}>Select Category</Text>
              {FOLDER_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.pickerItem,
                    folderCategory === cat.value && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setFolderCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    folderCategory === cat.value && styles.pickerItemTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                  {folderCategory === cat.value && (
                    <Text style={styles.check}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showActions}
          transparent
          animationType="fade"
          onRequestClose={() => setShowActions(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowActions(false)}
          >
            <View style={styles.actionsModal}>
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActions(false);
                  pickDocument();
                }}
              >
                <Text style={styles.actionMenuIcon}>📤</Text>
                <Text style={styles.actionMenuText}>Upload New File</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActions(false);
                  Alert.alert('Export', 'Export feature available in web version');
                }}
              >
                <Text style={styles.actionMenuIcon}>📥</Text>
                <Text style={styles.actionMenuText}>Export to DOCX</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => setShowActions(false)}
              >
                <Text style={styles.actionMenuIcon}>✕</Text>
                <Text style={styles.actionMenuText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: COLORS.navy,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  menuBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  menuBtnText: { color: COLORS.white, fontSize: 18, fontWeight: '600' },

  infoSection: {
    padding: 16, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.subText, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.offWhite, borderRadius: 8, padding: 12, fontSize: 16,
    color: COLORS.darkText, borderWidth: 1, borderColor: COLORS.lightGray, marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.offWhite, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  pickerText: { fontSize: 14, color: COLORS.darkText },
  placeholder: { color: COLORS.midGray },
  arrow: { fontSize: 10, color: COLORS.midGray },

  uploadBtn: {
    margin: 16, padding: 32, backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.navy, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadBtnIcon: { fontSize: 40, marginBottom: 8 },
  uploadBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  uploadBtnSub: { fontSize: 12, color: COLORS.midGray, marginTop: 4 },

  editorContainer: {
    flex: 1, margin: 16, marginBottom: 0, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  webView: { flex: 1 },
  emptyEditor: {
    flex: 1, margin: 16, borderRadius: 12, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.lightGray,
  },
  emptyEditorText: { fontSize: 14, color: COLORS.midGray },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.subText },

  actions: {
    flexDirection: 'row', padding: 16, gap: 12, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.lightGray,
  },
  actionBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  draftBtn: { backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.lightGray },
  draftBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  submitBtn: { backgroundColor: COLORS.navy },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 20,
    width: '80%', maxHeight: '60%',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkText, marginBottom: 16, textAlign: 'center' },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  pickerItemActive: { backgroundColor: '#EEF3FB' },
  pickerItemText: { fontSize: 14, color: COLORS.darkText },
  pickerItemTextActive: { color: COLORS.navy, fontWeight: '700' },
  check: { fontSize: 14, color: COLORS.navy, fontWeight: '700' },

  actionsModal: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, width: '80%' },
  actionMenuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  actionMenuIcon: { fontSize: 20, marginRight: 12 },
  actionMenuText: { fontSize: 14, color: COLORS.darkText },
});