/**
 * scannerTypes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared type contract for the document scanner hook.
 *
 * Both useDocumentScanner.web.ts and useDocumentScanner.native.ts implement
 * UseDocumentScannerReturn. Metro's platform extension resolution means any
 * `import ... from './useDocumentScanner'` (no extension) picks the right
 * file per platform automatically — ScanModal.tsx, CropModal.tsx, and
 * CropEditor.tsx never need to know which one they got.
 */

export interface CropRegion {
  x: number; // % of image width  (0-100)
  y: number; // % of image height (0-100)
  w: number; // % of image width  (0-100)
  h: number; // % of image height (0-100)
}

export interface QuadCorners {
  tl: { x: number; y: number }; // top-left
  tr: { x: number; y: number }; // top-right
  br: { x: number; y: number }; // bottom-right
  bl: { x: number; y: number }; // bottom-left
}

export type FilterMode = 'none' | 'grayscale' | 'bw' | 'document';

export interface ScannedPage {
  id: string;
  dataUrl: string; // JPEG data-URL (web) or local file URI (native) of the cropped, enhanced image
  filter: FilterMode;
  addedAt: number;
}

export interface ScannedFile {
  uri: string;   // blob: URL (web) or local file URI (native)
  name: string;
  type: 'application/pdf';
  size: number | null;
}

export interface UseDocumentScannerReturn {
  // State
  pages: ScannedPage[];
  scanning: boolean;
  convertingToPdf: boolean;
  cropImageSrc: string | null;
  cropRegion: CropRegion;
  cropCorners: QuadCorners;
  cropModalVisible: boolean;
  scanModalVisible: boolean;
  autoDetecting: boolean;
  filterMode: FilterMode;

  // Refs (web only — the native implementation exposes these as harmless
  // unused refs so components that destructure them don't need a platform check)
  webCameraInputRef?: React.RefObject<HTMLInputElement | null>;
  webGalleryInputRef?: React.RefObject<HTMLInputElement | null>;

  // Actions
  openScanModal: () => void;
  closeScanModal: () => void;
  openCropFor: (dataUrl: string) => void;
  handleWebFileInput?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAutoCrop: (autoConfirm?: boolean) => Promise<void>;
  handleCropConfirm: () => Promise<void>;
  handleCropSkip: () => void;
  removePage: (id: string) => void;
  reorderPages: (from: number, to: number) => void;
  setCropRegion: React.Dispatch<React.SetStateAction<CropRegion>>;
  setCropCorners: React.Dispatch<React.SetStateAction<QuadCorners>>;
  setFilterMode: React.Dispatch<React.SetStateAction<FilterMode>>;
  compileToPdf: () => Promise<ScannedFile | null>;
  addCameraCapture: () => void;
  addFromGallery: () => void;
}
