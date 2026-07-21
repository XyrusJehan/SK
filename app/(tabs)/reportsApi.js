// ─── reportsApi.js ──────────────────────────────────────────────────────────
// Data layer for the LYDO Monitor > Report screen.
//
// This app talks to Supabase directly from the client (see authContext.js —
// there is no custom REST backend and no bearer token), so this module does
// the same: it queries Supabase tables directly and merges the results in
// JS. Adjust the import path below to wherever your supabase client lives
// relative to this file (it mirrors the '../../utils/supabase' path used in
// authContext.js — update if this file sits in a different folder).
import { supabase } from '../../utils/supabase';

// ─── What each sub-tab actually means against the schema ──────────────────
//
//  TRANSPARENCY  -> "Did the barangay PUBLISH the required document on the
//                    Full Disclosure Policy board on time?"
//                    documents (status = 'published', submitted_at /
//                    reviewed_at) matched against submission_deadlines for
//                    the deadline date.
//
//  SUBMISSION    -> "Did the barangay SUBMIT proof of compliance (a scanned
//                    copy) to LYDO by the deadline?"
//                    submission_deadlines (is_met, met_at) left-joined
//                    against compliance_documents (the uploaded scanned
//                    file that satisfies the deadline).
//
// Both return the SAME row shape so the UI doesn't need to know which one
// it's looking at:
//   {
//     barangayId, barangayName,
//     docType,          // 'ABYIP' | 'CBYDP' | 'SK Budget' | 'Accomplishment'
//     document,         // human readable title
//     deadline,         // 'January 14, 2026'
//     deadlineRaw,      // raw date, for sorting
//     time, date,       // formatted, or null if nothing to show
//     status,           // 'on_time' | 'late' | 'no_pub'
//     fileUrl,          // link to the published doc / scanned proof
//   }
// ─────────────────────────────────────────────────────────────────────────

// The 4 document types LYDO tracks. Keep in sync with DOCUMENT_OPTIONS in
// lydo-monitor-report.js.
export const DOCUMENT_TYPES = ['ABYIP', 'CBYDP', 'SK Budget', 'Accomplishment'];

export const DOC_FULL_NAMES = {
  CBYDP: 'CBYDP',
  ABYIP: 'Annual Budget Youth Investment Program',
  'SK Budget': 'Annual Budget',
  Accomplishment: 'Monthly Itemized List',
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtShortDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric',
  });
}
function fmtTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
  });
}

// on_time if the actual date is on/before the deadline, late if after,
// no_pub if there's no actual date at all.
export function computeStatus(deadlineDate, actualDate) {
  if (!actualDate) return 'no_pub';
  if (!deadlineDate) return 'on_time'; // no deadline set — can't be "late"
  return new Date(actualDate) <= new Date(deadlineDate) ? 'on_time' : 'late';
}

// ── TRANSPARENCY (FDP publication monitoring) ──────────────────────────────
// Built from 3 queries merged client-side (barangays × doc types), since
// Supabase's query builder can't express the "every barangay × every doc
// type, even if nothing was submitted" cross join in one call:
//   1. barangays              -> the full roster of barangays
//   2. submission_deadlines   -> deadline_date per barangay/doc type/year
//   3. documents              -> what was actually published, per barangay/
//                                doc type/year
export async function fetchTransparencyReport({ year, documentType = 'All' }) {
  const docTypes = documentType === 'All' ? DOCUMENT_TYPES : [documentType];
  const yearNum = Number(year);

  const [{ data: barangays, error: bErr }, { data: deadlines, error: dErr }, { data: documents, error: docErr }] =
    await Promise.all([
      supabase.from('barangays').select('barangay_id, barangay_name').order('barangay_name'),
      supabase
        .from('submission_deadlines')
        .select('barangay_id, document_type, deadline_date')
        .in('document_type', docTypes)
        .gte('deadline_date', `${yearNum}-01-01`)
        .lte('deadline_date', `${yearNum}-12-31`),
      supabase
        .from('documents')
        .select('barangay_id, document_type, title, status, submitted_at, reviewed_at, file_view_url')
        .eq('year', yearNum)
        .in('document_type', docTypes),
    ]);

  if (bErr) throw bErr;
  if (dErr) throw dErr;
  if (docErr) throw docErr;

  const rows = [];
  for (const b of barangays || []) {
    for (const dt of docTypes) {
      const deadlineRec = (deadlines || []).find(
        d => d.barangay_id === b.barangay_id && d.document_type === dt
      );
      const docRec = (documents || []).find(
        d => d.barangay_id === b.barangay_id && d.document_type === dt
      );
      const publishedAt = docRec?.status === 'published'
        ? (docRec.submitted_at || docRec.reviewed_at)
        : null;
      const status = computeStatus(deadlineRec?.deadline_date, publishedAt);

      rows.push({
        barangayId: b.barangay_id,
        barangayName: b.barangay_name,
        docType: dt,
        document: docRec?.title || DOC_FULL_NAMES[dt] || dt,
        deadline: fmtDate(deadlineRec?.deadline_date),
        deadlineRaw: deadlineRec?.deadline_date || null,
        time: fmtTime(publishedAt),
        date: fmtShortDate(publishedAt),
        status,
        fileUrl: docRec?.file_view_url || null,
      });
    }
  }
  return rows;
}

// ── SUBMISSION (compliance deadline tracking) ──────────────────────────────
// One row per submission_deadlines record (these are the deadlines LYDO
// actually created per barangay), left-joined to compliance_documents for
// the scanned proof file that satisfied it.
export async function fetchSubmissionReport({ year, documentType = 'All' }) {
  const yearNum = Number(year);

  let query = supabase
    .from('submission_deadlines')
    .select(`
      deadline_id, barangay_id, document_type, description,
      deadline_date, is_met, met_at,
      barangays ( barangay_name )
    `)
    .gte('deadline_date', `${yearNum}-01-01`)
    .lte('deadline_date', `${yearNum}-12-31`);

  if (documentType !== 'All') query = query.eq('document_type', documentType);

  const { data: deadlines, error } = await query;
  if (error) throw error;

  const deadlineIds = (deadlines || []).map(d => d.deadline_id);
  let compliance = [];
  if (deadlineIds.length) {
    const { data: cd, error: cErr } = await supabase
      .from('compliance_documents')
      .select('compliance_id, deadline_id, scanned_file_url, upload_date')
      .in('deadline_id', deadlineIds);
    if (cErr) throw cErr;
    compliance = cd || [];
  }

  return (deadlines || []).map(d => {
    const comp = compliance.find(c => c.deadline_id === d.deadline_id);
    const metAt = d.is_met ? (d.met_at || comp?.upload_date) : null;
    const status = computeStatus(d.deadline_date, metAt);

    return {
      barangayId: d.barangay_id,
      barangayName: d.barangays?.barangay_name || '—',
      docType: d.document_type,
      document: d.description || DOC_FULL_NAMES[d.document_type] || d.document_type,
      deadline: fmtDate(d.deadline_date),
      deadlineRaw: d.deadline_date,
      time: fmtTime(metAt),
      date: fmtShortDate(metAt),
      status,
      fileUrl: comp?.scanned_file_url || null,
      deadlineId: d.deadline_id,
      complianceId: comp?.compliance_id || null,
    };
  });
}

// ── SAVE REPORT (persist a generated snapshot) ──────────────────────────────
// Records that a report snapshot was generated by inserting a row into
// `documents` (folder_category: 'performance') so saved reports show up
// alongside other documents and get the normal document_versions history.
//
// The actual PDF is rendered client-side by reportPdf.js (expo-print), then
// optionally uploaded to Supabase Storage; pass the resulting public URL in
// via `fileUrl` so it gets linked to this row (status flips to 'published'
// when a fileUrl is present, 'saved' when it's just a metadata-only record —
// e.g. on web, where the browser's print dialog handles saving and no file
// is uploaded back to Storage).
const REPORT_TYPE_META = {
  transparency: { label: 'FDP Transparency', docType: 'FDP_Monitoring_Report' },
  submission:   { label: 'Submission Compliance', docType: 'Submission_Compliance_Report' },
  combined:     { label: 'Full Compliance', docType: 'Full_Compliance_Report' },
};

export async function saveReportSnapshot({ reportType, year, documentType, userId, fileUrl = null }) {
  const meta = REPORT_TYPE_META[reportType] || REPORT_TYPE_META.combined;
  const { data, error } = await supabase
    .from('documents')
    .insert({
      submitted_by: userId,
      title: `${meta.label} Report ${documentType} ${year}`,
      folder_category: 'performance',
      document_type: meta.docType,
      status: fileUrl ? 'published' : 'saved',
      year: Number(year),
      saved_at: new Date().toISOString(),
      submitted_at: fileUrl ? new Date().toISOString() : null,
      file_url: fileUrl,
      file_view_url: fileUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return { document: data, fileUrl: data?.file_url || null };
}