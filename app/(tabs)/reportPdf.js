// ─── reportPdf.js ───────────────────────────────────────────────────────────
// Turns the Transparency / Submission report data into an actual PDF the
// user can save or share, using Expo's print pipeline (HTML -> PDF).
//
// Requires these packages (install if not already present):
//   npx expo install expo-print expo-sharing expo-file-system
//   npm install base64-arraybuffer html2pdf.js
//
// NOTE (web/Metro): we import 'html2pdf.js/dist/html2pdf.bundle.js' below
// rather than the bare 'html2pdf.js' entry point. The bare entry point
// needs Metro to separately resolve the 'html2canvas' package, which
// Metro's resolver can't do reliably (fails with a "package main field
// could not be resolved" error) — the bundle build has html2canvas and
// jsPDF compiled in, so nothing extra needs resolving.
//
// Flow:
//   1. buildTransparencyReportHtml() / buildSubmissionReportHtml()
//                          -> each renders ONE standalone report (its own
//                             letterhead, table, and signature block) as
//                             HTML. These are independent — call whichever
//                             one(s) you need. They are never merged into
//                             a single document; each becomes its own PDF.
//   2. exportReportToPdf() -> turns a given HTML string into a real PDF file
//                             (call once per report to get separate files):
//        - native (iOS/Android): Print.printToFileAsync() writes a PDF to
//          the cache dir, then Sharing.shareAsync() opens the native
//          share sheet so the user can save it to Files, Drive, etc.
//        - web: rendered to a PDF in-browser with html2pdf.js and saved
//          directly as a file download — no print dialog is shown.
//   3. uploadReportPdf()   -> uploads the generated PDF to the 'documents'
//          Supabase Storage bucket so it can be linked from a
//          `compliance_documents` row and reopened later from the
//          Documents > Reports tab.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '../../utils/supabase';

const STATUS_META = {
  on_time: { color: '#1B5E20', bg: '#E8F5E9', border: '#A5D6A7', label: 'On Time' },
  late:    { color: '#8A4B00', bg: '#FFF3E0', border: '#FFCC80', label: 'Late' },
  no_pub:  { color: '#7A0000', bg: '#FDECEC', border: '#F1B0B0', label: 'No Publication' },
};

// Formal document typography — serif for headings/labels (reads as an
// official report), a plain sans-serif reserved for dense table data so
// long rows of dates/names stay easy to scan.
const SERIF = `'Georgia','Times New Roman',Times,serif`;
const SANS = `Helvetica,Arial,sans-serif`;

const TH = `text-align:left;font-size:9.5px;font-weight:700;padding:8px 10px;border:1px solid #133E75;background:#133E75;color:#FFFFFF;letter-spacing:0.4px;text-transform:uppercase;`;
const TD = `font-family:${SANS};font-size:10px;padding:7px 10px;border:1px solid #D9D9D9;color:#1A1A1A;`;

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusBadge(status) {
  const meta = STATUS_META[status] || STATUS_META.no_pub;
  return `<span style="display:inline-block;padding:3px 11px;border-radius:3px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:${meta.color};background:${meta.bg};border:1px solid ${meta.border};">${meta.label}</span>`;
}

// Deterministic-looking document control number, e.g. FDP-2026-0417-A3C9,
// so a printed/saved copy can be referenced or reconciled later.
function docReferenceNumber(kind, year) {
  const prefix = kind === 'transparency' ? 'FDP' : 'SUB';
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${year}-${stamp}`;
}

function groupByBarangay(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const name = r.barangayName || r.barangay;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(r);
  });
  return Array.from(map.entries()).map(([barangay, docs]) => ({ barangay, docs }));
}

// Single "important" date column instead of separate time+date — exact
// submission time isn't something the Federation needs on a printed report.
function dateOnlyCell(date) {
  return date ? esc(date) : 'N/A';
}

function summarize(rows) {
  const total = rows.length;
  const onTime = rows.filter(r => r.status === 'on_time').length;
  const late = rows.filter(r => r.status === 'late').length;
  const noPub = rows.filter(r => r.status === 'no_pub').length;
  const rate = total ? Math.round((onTime / total) * 100) : 0;
  return { total, onTime, late, noPub, rate };
}

// Formal bordered summary table (reads like a report's "Executive Summary"
// block) rather than floating dashboard-style cards.
function summaryTable(stats) {
  const cell = (label, value, color) => `
    <td style="width:25%;text-align:center;padding:10px 6px;border:1px solid #D9D9D9;">
      <div style="font-family:${SANS};font-size:8.5px;font-weight:700;color:#5A5A5A;letter-spacing:0.9px;text-transform:uppercase;margin-bottom:5px;">${esc(label)}</div>
      <div style="font-family:${SERIF};font-size:20px;font-weight:700;color:${color};">${esc(String(value))}</div>
    </td>
  `;
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:#F7F5F2;">
        ${cell('Compliance Rate', `${stats.rate}%`, '#133E75')}
        ${cell('On Time', stats.onTime, '#1B5E20')}
        ${cell('Late', stats.late, '#8A4B00')}
        ${cell('No Publication', stats.noPub, '#7A0000')}
      </tr>
    </table>
  `;
}

// Renders ONE report section — its own heading, its own summary row, its own
// table with the date column labeled for what it actually is. Called once
// for Transparency and once for Submission, so the two are never merged
// into a single table with mismatched columns.
function renderSection({ heading, dateCol, selectedDoc, rows }) {
  const isAllView = selectedDoc === 'All';
  const stats = summarize(rows);
  const summaryHtml = summaryTable(stats);

  const emptyState = `<p style="font-family:${SANS};font-size:11px;color:#666;font-style:italic;padding:12px 0;">No records found for the selected criteria.</p>`;

  let tableHtml;
  if (isAllView) {
    const groups = groupByBarangay(rows);
    tableHtml = groups.map((g) => `
      <div style="page-break-inside:avoid;margin-bottom:14px;">
        <div style="font-family:${SERIF};font-size:11.5px;font-weight:700;color:#FFFFFF;background:#133E75;padding:5px 10px;letter-spacing:0.3px;">${esc(g.barangay)}</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="${TH}">Document</th>
              <th style="${TH}">Submission Deadline</th>
              <th style="${TH}text-align:right;">${dateCol}</th>
              <th style="${TH}text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${g.docs.map((d, i) => `
              <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#FAF9F7'};">
                <td style="${TD}">${esc(d.document)}</td>
                <td style="${TD}">${esc(d.deadline || 'N/A')}</td>
                <td style="${TD}text-align:right;">${dateOnlyCell(d.date)}</td>
                <td style="${TD}text-align:center;">${statusBadge(d.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('') || emptyState;
  } else {
    tableHtml = rows.length ? `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${TH}">Barangay</th>
            <th style="${TH}">Document</th>
            <th style="${TH}">Submission Deadline</th>
            <th style="${TH}text-align:right;">${dateCol}</th>
            <th style="${TH}text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#FAF9F7'};">
              <td style="${TD}">${esc(r.barangayName || r.barangay)}</td>
              <td style="${TD}">${esc(r.document)}</td>
              <td style="${TD}">${esc(r.deadline || 'N/A')}</td>
              <td style="${TD}text-align:right;">${dateOnlyCell(r.date)}</td>
              <td style="${TD}text-align:center;">${statusBadge(r.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : emptyState;
  }

  return `
    <div style="margin-bottom:22px;">
      <div style="font-family:${SERIF};font-size:13px;font-weight:700;color:#133E75;margin-bottom:10px;padding-bottom:5px;border-bottom:1.5px solid #E8C547;letter-spacing:0.2px;">${esc(heading)}</div>
      ${summaryHtml}
      ${tableHtml}
    </div>
  `;
}

// Shared page shell (letterhead + signature block + footer) used by both
// standalone report builders below, so the two documents look like a
// matched pair while being generated/exported completely independently.
function renderDocumentShell({ title, subheading, selectedDoc, selectedYear, generatedBy, sectionHtml, reportKind }) {
  const generatedAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  const isAllView = selectedDoc === 'All';
  const refNo = docReferenceNumber(reportKind, selectedYear);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 30px 36px; }
          body { font-family: ${SANS}; color: #1A1A1A; }
        </style>
      </head>
      <body>
        <!-- ── Letterhead: double rule, formal centered header ── -->
        <div style="text-align:center;padding-bottom:12px;">
          <div style="font-family:${SANS};font-size:9.5px;letter-spacing:2.5px;color:#5A5A5A;text-transform:uppercase;">Sangguniang Kabataan Federation</div>
          <div style="font-family:${SERIF};font-size:21px;font-weight:700;color:#133E75;letter-spacing:0.5px;margin-top:2px;">RIZAL, LAGUNA</div>
          <div style="height:5px;"></div>
          <div style="border-top:2.5px solid #133E75;border-bottom:1px solid #133E75;padding:2px 0;"></div>
        </div>

        <div style="text-align:center;margin-bottom:18px;">
          <div style="font-family:${SERIF};font-size:15px;font-weight:700;margin-top:10px;letter-spacing:0.3px;">${esc(title)}</div>
          ${subheading ? `<div style="font-family:${SANS};font-size:10px;color:#666;margin-top:2px;font-style:italic;">${esc(subheading)}</div>` : ''}
          <div style="font-family:${SANS};font-size:10.5px;color:#333;margin-top:6px;">Reporting Year ${esc(String(selectedYear))}${!isAllView ? ` &middot; ${esc(selectedDoc)}` : ''}</div>
        </div>

        <!-- ── Document control strip ── -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="font-family:${SANS};font-size:8.5px;color:#5A5A5A;padding:6px 0;border-top:1px solid #D9D9D9;border-bottom:1px solid #D9D9D9;">
              <strong style="color:#1A1A1A;">Reference No.:</strong> ${esc(refNo)}
            </td>
            <td style="font-family:${SANS};font-size:8.5px;color:#5A5A5A;padding:6px 0;border-top:1px solid #D9D9D9;border-bottom:1px solid #D9D9D9;text-align:right;">
              <strong style="color:#1A1A1A;">Date Prepared:</strong> ${esc(generatedAt)} PHT
            </td>
          </tr>
        </table>

        ${sectionHtml}

        <!-- ── Attestation block ── -->
        <table style="width:100%;margin-top:30px;page-break-inside:avoid;border-collapse:collapse;">
          <tr>
            <td style="width:45%;text-align:center;padding-top:24px;">
              <div style="border-bottom:1px solid #1A1A1A;height:1px;"></div>
              <div style="font-family:${SERIF};font-size:10.5px;font-weight:700;margin-top:6px;">LYDO Focal Person</div>
              <div style="font-family:${SANS};font-size:8.5px;color:#666;letter-spacing:0.3px;text-transform:uppercase;">Prepared by</div>
            </td>
            <td style="width:10%;"></td>
            <td style="width:45%;text-align:center;padding-top:24px;">
              <div style="border-bottom:1px solid #1A1A1A;height:1px;"></div>
              <div style="font-family:${SERIF};font-size:10.5px;font-weight:700;margin-top:6px;">SK Federation President</div>
              <div style="font-family:${SANS};font-size:8.5px;color:#666;letter-spacing:0.3px;text-transform:uppercase;">Noted by</div>
            </td>
          </tr>
        </table>

        <div style="font-family:${SANS};font-size:8.5px;color:#999;margin-top:24px;text-align:center;border-top:1px solid #ECECEC;padding-top:9px;">
          This is a system-generated report &middot; Ref. ${esc(refNo)}${generatedBy ? ` &middot; Prepared by ${esc(generatedBy)}` : ''} &middot; SK Compliance Monitoring System
        </div>
      </body>
    </html>
  `;
}

// Standalone FDP Transparency report — its own letterhead, its own single
// section/table, its own signature block. Entirely independent from the
// Submission Compliance report below; the two are generated and exported
// as two separate PDF files, never merged into one document.
//
// rows: flat rows from fetchTransparencyReport, already filtered to the
// selected document type ('All' means unfiltered).
export function buildTransparencyReportHtml({ selectedDoc, selectedYear, rows = [], generatedBy }) {
  const sectionHtml = renderSection({
    heading: 'Full Disclosure Policy (FDP) Board Publication Report',
    dateCol: 'Date Published',
    selectedDoc,
    rows,
  });

  return renderDocumentShell({
    title: 'FDP Transparency Report',
    subheading: 'Full Disclosure Policy Board Publication Monitoring',
    selectedDoc,
    selectedYear,
    generatedBy,
    sectionHtml,
    reportKind: 'transparency',
  });
}

// Standalone Submission Compliance report — mirrors
// buildTransparencyReportHtml above but for LYDO submission-deadline
// tracking.
//
// rows: flat rows from fetchSubmissionReport, already filtered to the
// selected document type ('All' means unfiltered).
export function buildSubmissionReportHtml({ selectedDoc, selectedYear, rows = [], generatedBy }) {
  const sectionHtml = renderSection({
    heading: 'Submission Compliance Report',
    dateCol: 'Date Submitted',
    selectedDoc,
    rows,
  });

  return renderDocumentShell({
    title: 'Submission Compliance Report',
    subheading: 'LYDO Submission Deadline Monitoring',
    selectedDoc,
    selectedYear,
    generatedBy,
    sectionHtml,
    reportKind: 'submission',
  });
}

// ── Generate the PDF and hand it to the user (share sheet on native, a
// direct file download on web — no print dialog). Returns a local file uri
// on native (null on web, since the browser triggers the download itself).
//
// IMPORTANT (web): expo-print's Print.printAsync({ html }) does NOT actually
// print the given html on web — per Expo's own docs, "On web prints the HTML
// from the current page." Passing `html` there is silently ignored, which is
// why an earlier version of this bypassed expo-print and opened a manual
// print window instead — but that route always surfaces the browser's native
// print dialog (Ctrl/Cmd+P UI), which is what you're seeing. There's no way
// to call window.print() and skip that dialog; it's a browser security
// restriction, not something fixable from app code.
//
// To get a true one-click download on web, we render the HTML to an actual
// PDF file in-browser (via html2pdf.js — jsPDF + html2canvas under the
// hood) and save it with a blob download, so no dialog appears at all.
//
// Requires: npm install html2pdf.js
export async function exportReportToPdf({ html, filename }) {
  // Belt-and-suspenders web check: Platform.OS is normally 'web' in an
  // Expo web build, but if that ever misreports (bundler/runtime quirk)
  // the code below would otherwise fall through to Print.printToFileAsync,
  // which on web has no real "print to file" and just triggers the
  // browser's native print dialog instead of a direct download. Checking
  // for an actual DOM/window makes this path unambiguous.
  const isWeb = Platform.OS === 'web' || (typeof window !== 'undefined' && typeof document !== 'undefined');

  if (isWeb) {
    // Dynamic import so this (browser-only) dependency never gets pulled
    // into the native bundle.
    //
    // IMPORTANT: import the BUNDLED build ('html2pdf.js/dist/html2pdf.bundle.js'),
    // not the bare 'html2pdf.js' entry point. The bare entry point requires
    // Metro to separately resolve the 'html2canvas' package, and Metro's
    // resolver can't follow that package's dist layout the way
    // Webpack/Vite can — it fails with a "package main field could not be
    // resolved" error. The bundle build has html2canvas and jsPDF compiled
    // directly into it, so no separate resolution of either is needed.
    let html2pdfMod;
    try {
      html2pdfMod = await import('html2pdf.js/dist/html2pdf.bundle.js');
    } catch (importErr) {
      console.error('html2pdf.js failed to load:', importErr);
      throw new Error(
        'PDF generation library (html2pdf.js) is not available. Run "npm install html2pdf.js" and rebuild.'
      );
    }
    const html2pdf = html2pdfMod.default || html2pdfMod;

    // html2pdf renders a live DOM node, not a raw HTML string, so the
    // full document (including our <style>/@page rules) is parsed into an
    // offscreen container first, then handed to html2canvas.
    //
    // IMPORTANT: a container with no explicit width can get laid out
    // differently than it would on-screen — table columns lose their
    // side-by-side layout and header cells (Document / Submission Deadline
    // / Date Published / Status) end up stacking as plain text instead of
    // rendering as a row. Giving the container a fixed width matching the
    // printed page (A4 @ 96dpi ≈ 794px, minus our left/right page margins)
    // forces normal table layout before html2canvas captures it.
    //
    // IMPORTANT (verified against a real headless-Chromium run — see the
    // PR discussion for the repro): this used to hide the container by
    // pushing it off-screen with `position: fixed/absolute; left:
    // -10000px`. That produces a BLANK PDF every time: html2canvas clones
    // the page into its own offscreen render frame to capture it, and an
    // element sitting outside that frame's coordinate space measures as
    // 0px tall in the clone — regardless of scroll position — even though
    // it has real content and a real height in the live document. The
    // capture silently succeeds with a 0-height canvas, producing a
    // near-empty PDF (confirmed: ~3KB of PDF structure with zero rendered
    // image data, vs. ~230KB+ once actually populated).
    //
    // The fix is to keep the container in normal in-flow layout (so
    // html2canvas's clone measures it correctly) and hide it visually with
    // a zero-height, `overflow: hidden` wrapper instead of moving it off
    // the page.
    const clipper = document.createElement('div');
    clipper.style.height = '0px';
    clipper.style.overflow = 'hidden';
    const container = document.createElement('div');
    container.style.width = '722px'; // 794px A4 width - 36px margins*2
    container.innerHTML = html;
    clipper.appendChild(container);
    document.body.appendChild(clipper);

    // Pull the <body> content out of the full HTML document string — the
    // container is already off-DOM, so we only need the rendered content,
    // not another nested <html>/<head>. Force every table to lay out as
    // a real table (belt-and-suspenders alongside the width fix above).
    const bodyEl = container.querySelector('body') || container;
    bodyEl.querySelectorAll('table').forEach((t) => {
      t.style.display = 'table';
      t.style.tableLayout = 'auto';
      t.style.width = '100%';
    });
    bodyEl.querySelectorAll('thead').forEach((t) => { t.style.display = 'table-header-group'; });
    bodyEl.querySelectorAll('tbody').forEach((t) => { t.style.display = 'table-row-group'; });
    bodyEl.querySelectorAll('tr').forEach((t) => { t.style.display = 'table-row'; });
    bodyEl.querySelectorAll('th').forEach((t) => { t.style.display = 'table-cell'; });
    bodyEl.querySelectorAll('td').forEach((t) => { t.style.display = 'table-cell'; });

    try {
      await html2pdf()
        .set({
          filename,
          // Real page margin, matching the report's own @page rule (30px
          // 36px, converted px->pt at 0.75). With margin: 0, html2pdf
          // stretches/pins the rendered image flush to the page's left
          // edge instead of centering it, which is what produced the
          // lopsided/off-center look in the exported PDF.
          margin: [22.5, 27, 22.5, 27], // top, left, bottom, right (pt)
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
          // Respects the existing `page-break-inside: avoid` rules already
          // in the report HTML (per-barangay blocks, signature block) so
          // sections don't get sliced across pages.
          pagebreak: { mode: ['css', 'avoid-all'] },
        })
        .from(bodyEl)
        .save();
    } finally {
      document.body.removeChild(clipper);
    }

    return { uri: null };
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // printToFileAsync names the file randomly — copy it to a friendly name
  // so the share sheet / saved file shows the report's real filename.
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(dest, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }

  return { uri: dest };
}

// ── Render the report HTML straight to a base64 PDF (no share sheet / no
// print dialog). Used by the "Save" flow so the PDF can be uploaded to the
// 'documents' Storage bucket without ever prompting the user to pick a
// save location — the file lands in compliance_documents instead, and the
// user re-opens it from Documents > Reports.
//
// Returns { base64, filename } on both web and native. On web the browser
// doesn't write a real file, so the only thing the user can hand off to
// Storage is the base64 string.
export async function renderReportToBase64({ html, filename }) {
  const isWeb = Platform.OS === 'web' || (typeof window !== 'undefined' && typeof document !== 'undefined');

  if (isWeb) {
    let html2pdfMod;
    try {
      html2pdfMod = await import('html2pdf.js/dist/html2pdf.bundle.js');
    } catch (importErr) {
      throw new Error(
        'PDF generation library (html2pdf.js) is not available. Run "npm install html2pdf.js" and rebuild.'
      );
    }
    const html2pdf = html2pdfMod.default || html2pdfMod;

    // Same off-DOM / in-flow container pattern used in exportReportToPdf
    // so html2canvas's clone measures the element correctly (see the long
    // comment block there for the full explanation).
    const clipper = document.createElement('div');
    clipper.style.height = '0px';
    clipper.style.overflow = 'hidden';
    const container = document.createElement('div');
    container.style.width = '722px';
    container.innerHTML = html;
    clipper.appendChild(container);
    document.body.appendChild(clipper);

    const bodyEl = container.querySelector('body') || container;
    bodyEl.querySelectorAll('table').forEach((t) => {
      t.style.display = 'table';
      t.style.tableLayout = 'auto';
      t.style.width = '100%';
    });
    bodyEl.querySelectorAll('thead').forEach((t) => { t.style.display = 'table-header-group'; });
    bodyEl.querySelectorAll('tbody').forEach((t) => { t.style.display = 'table-row-group'; });
    bodyEl.querySelectorAll('tr').forEach((t) => { t.style.display = 'table-row'; });
    bodyEl.querySelectorAll('th').forEach((t) => { t.style.display = 'table-cell'; });
    bodyEl.querySelectorAll('td').forEach((t) => { t.style.display = 'table-cell'; });

    try {
      // html2pdf's chain ends with .output(type), which can be 'datauristring',
      // 'dataurl', 'blob', 'save' (triggers a browser download), etc. We want
      // the raw PDF bytes as base64 so Storage can hold them — 'datauristring'
      // returns a `data:application/pdf;base64,...` URL we strip the prefix
      // from. The method is normally synchronous in html2pdf.js (returns a
      // string), but be defensive in case a bundler ever returns a Promise.
      const chain = html2pdf()
        .set({
          filename,
          margin: [22.5, 27, 22.5, 27],
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'avoid-all'] },
        })
        .from(bodyEl);
      const dataUri = await Promise.resolve(chain.output('datauristring'));
      const base64 = typeof dataUri === 'string' ? dataUri.split(',', 2)[1] || '' : '';
      return { base64, filename };
    } finally {
      document.body.removeChild(clipper);
    }
  }

  // Native: write a PDF to the cache dir, then read it back as base64.
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, filename };
}

// ── Optional: persist the PDF to Supabase Storage so it's linked from the
// saved `compliance_documents` row (scanned_file_url) and can be reopened
// from the Documents > Reports tab later, not just from the device it was
// generated on.
//
// Accepts either a local file uri (native, after Print.printToFileAsync) OR
// a base64 string (web, after the in-browser render). Pass whichever one
// you have — the function detects the format and uploads accordingly.
//
// Requires a Storage bucket named 'documents'. Create it once in the Supabase
// dashboard (Storage -> New bucket -> "documents", public if you want direct
// links, or private + use createSignedUrl if these should stay internal).
export async function uploadReportPdf({ uri, base64, filename }) {
  let bytes;
  if (base64) {
    bytes = decodeBase64(base64);
  } else if (uri) {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    bytes = decodeBase64(b64);
  } else {
    return null;
  }

  const path = `reports/${Date.now()}_${filename}`;

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  return data?.publicUrl || null;
}