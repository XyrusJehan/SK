/**
 * useDocumentScanner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Base fallback — NOT the real implementation. Metro's bundler resolves
 * `import { useDocumentScanner } from './useDocumentScanner'` to
 * useDocumentScanner.web.ts (web) or useDocumentScanner.native.ts (iOS/Android)
 * automatically, based on the platform extension — this file is never actually
 * reached in a normal app build. It only exists because Metro's resolver
 * expects a non-platform-suffixed sibling next to .web.ts/.native.ts files;
 * without it you'll see "does not have a fallback sibling file without a
 * platform extension".
 *
 * Kept functional (not a stub) so anything that DOESN'T do RN platform
 * resolution — e.g. some Jest configs, a plain Node script — still works.
 */

import { Platform } from 'react-native';

export * from './scannerTypes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = Platform.OS === 'web'
  ? require('./useDocumentScanner.web')
  : require('./useDocumentScanner.native');

export const useDocumentScanner = impl.useDocumentScanner;
export default impl.default ?? impl.useDocumentScanner;