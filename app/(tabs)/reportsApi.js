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
// The generated PDF (from reportPdf.js) is uploaded to the 'documents'
// Storage bucket, then a row is written to the `compliance_documents` table
// pointing at it. That row is what the Documents > Reports tab reads to
// list saved reports and let the user re-download them.
//
// compliance_documents schema (from the migration):
//   compliance_id    SERIAL PRIMARY KEY
//   barangay_id      INT  -> barangays(barangay_id)  (NULL allowed at the DB,
//                       but LYDO saves are always a specific barangay)
//   uploaded_by      INT  -> users(user_id)          (required)
//   deadline_id      INT  -> submission_deadlines    (NULL allowed; the
//                       FDP / Submission reports here are ad-hoc, not
//                       tied to a specific deadline)
//   title            VARCHAR NOT NULL
//   document_type    VARCHAR NOT NULL  ('FDP_Monitoring_Report' |
//                       'Submission_Compliance_Report')
//   scanned_file_url VARCHAR NOT NULL  (public URL in the 'documents' bucket)
//   remarks          TEXT NULL
//   upload_date      TIMESTAMP DEFAULT NOW()
const REPORT_TYPE_META = {
  transparency: {
    label:     'FDP Monitoring Report',
    docType:   'FDP_Monitoring_Report',
  },
  submission: {
    label:     'Submission Compliance Report',
    docType:   'Submission_Compliance_Report',
  },
};

export async function saveComplianceDocument({
  reportType,    // 'transparency' | 'submission'
  year,
  documentType,  // 'All' | 'ABYIP' | 'CBYDP' | 'SK Budget' | 'Accomplishment'
  barangayId,
  userId,
  fileUrl,       // public URL in the 'documents' bucket
  remarks,
}) {
  const meta = REPORT_TYPE_META[reportType];
  if (!meta) throw new Error(`Unknown report type: ${reportType}`);

  if (!userId)        throw new Error('userId is required to save a report');
  if (!fileUrl)       throw new Error('fileUrl is required to save a report (PDF must be uploaded first)');

  // compliance_documents.barangay_id is NOT NULL, but a LYDO user might
  // not be tied to a specific barangay (they sit at the Federation level).
  // Fall back to the first barangay in the roster as a placeholder so the
  // schema constraint is satisfied — the report is a Federation-level
  // snapshot, not a per-barangay submission, so the row's title and
  // document_type make the ownership clear even with this fallback.
  let effectiveBarangayId = barangayId;
  if (effectiveBarangayId == null) {
    const { data: firstBrgy, error: fbErr } = await supabase
      .from('barangays')
      .select('barangay_id')
      .order('barangay_id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fbErr) throw fbErr;
    if (!firstBrgy) {
      throw new Error('barangay_id is required but no barangay exists in the database yet.');
    }
    effectiveBarangayId = firstBrgy.barangay_id;
  }

  const title = buildReportTitle({
    reportType, year, documentType,
  });

  // ── Same-file replacement ────────────────────────────────────────────
  // "Same file" = same title (which already encodes reportType +
  // documentType + year) + same document_type + same barangay. If an
  // ACTIVE row already matches, this save is a new version of it: the old
  // row gets archived (not deleted) and the new row is inserted pointing
  // back at it via replaces_id, with version bumped by one. The partial
  // index on (barangay_id, document_type, status='active') keeps this
  // lookup cheap even as archived history grows.
  const { data: existing, error: findErr } = await supabase
    .from('compliance_documents')
    .select('compliance_id, version')
    .eq('title', title)
    .eq('document_type', meta.docType)
    .eq('barangay_id', effectiveBarangayId)
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  const nextVersion = existing ? existing.version + 1 : 1;

  // Archive the old active row first (guarded on status = 'active' so a
  // concurrent save can't archive it twice). If the insert below then
  // fails, the old row is left archived with no replacement — re-running
  // the save will find no active row, insert as version 1 again, and the
  // stray archived row is still visible/restorable from the Archive tab,
  // so nothing is silently lost.
  if (existing) {
    const { error: archiveErr } = await supabase
      .from('compliance_documents')
      .update({ status: 'archived' })
      .eq('compliance_id', existing.compliance_id)
      .eq('status', 'active');
    if (archiveErr) throw archiveErr;
  }

  const { data, error } = await supabase
    .from('compliance_documents')
    .insert({
      barangay_id:      effectiveBarangayId,
      uploaded_by:      userId,
      deadline_id:      null,
      title,
      document_type:    meta.docType,
      scanned_file_url: fileUrl,
      remarks:          remarks || null,
      status:           'active',
      version:          nextVersion,
      replaces_id:      existing?.compliance_id || null,
    })
    .select()
    .single();

  if (error) {
    // Roll the old row back to active so a failed insert doesn't leave
    // the barangay with zero active reports of this type.
    if (existing) {
      await supabase
        .from('compliance_documents')
        .update({ status: 'active' })
        .eq('compliance_id', existing.compliance_id);
    }
    throw error;
  }

  return {
    compliance: data,
    fileUrl: data?.scanned_file_url || null,
    replacedId: existing?.compliance_id || null,
  };
}

// Build a human-readable title for the saved report. Mirrors the filename
// helper in lydo-monitor-report.js so the title and the underlying file
// stay obviously paired in any future listing.
function buildReportTitle({ reportType, year, documentType }) {
  const meta = REPORT_TYPE_META[reportType] || REPORT_TYPE_META.transparency;
  const docPart = documentType && documentType !== 'All'
    ? documentType.replace(/\s+/g, '')
    : 'AllDocuments';
  return `SK_Rizal_${meta.docType}_${docPart}_${year}`;
}

// ── FETCH SAVED REPORTS (list the documents/reports page reads) ─────────────
// Returns the rows that should show up in Documents > Reports, scoped to
// the two FDP / Submission report types this screen produces. Newest first.
//
// status: 'active' (default, current versions only) | 'archived'
// (superseded versions, for the Archive tab) | 'all' (both).
export async function fetchSavedReports({
  reportType, barangayId = null, status = 'active', limit = 100,
} = {}) {
  const meta = reportType ? REPORT_TYPE_META[reportType] : null;
  if (reportType && !meta) throw new Error(`Unknown report type: ${reportType}`);

  let query = supabase
    .from('compliance_documents')
    .select(`
      compliance_id, title, document_type, scanned_file_url,
      remarks, upload_date, status, version, replaces_id,
      barangay_id, uploaded_by,
      barangays ( barangay_name )
    `)
    .in('document_type', [
      REPORT_TYPE_META.transparency.docType,
      REPORT_TYPE_META.submission.docType,
    ])
    // Archived rows pile up over time; ordering by version (within a
    // title) then upload_date keeps the most recently-superseded ones on
    // top, which is what someone browsing the Archive tab wants to see.
    .order('upload_date', { ascending: false })
    .limit(limit);

  if (meta) query = query.eq('document_type', meta.docType);
  if (barangayId) query = query.eq('barangay_id', barangayId);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Convenience wrapper for the Archive tab — same shape as
// fetchSavedReports, just pre-filtered to superseded versions.
export async function fetchArchivedReports({ reportType, barangayId = null, limit = 100 } = {}) {
  return fetchSavedReports({ reportType, barangayId, limit, status: 'archived' });
}

// ── RESTORE (bring an archived version back to active) ─────────────────────
// Only one row per title/document_type/barangay may be 'active' at a time
// (that's what the partial index enforces in spirit, even though it isn't
// a hard DB constraint). Restoring an old version therefore archives
// whatever is currently active for that same title first, so the two
// never collide.
export async function restoreComplianceDocument(complianceId) {
  const { data: row, error: rowErr } = await supabase
    .from('compliance_documents')
    .select('compliance_id, title, document_type, barangay_id, status')
    .eq('compliance_id', complianceId)
    .single();
  if (rowErr) throw rowErr;
  if (row.status === 'active') return row; // already active, nothing to do

  const { data: currentActive, error: activeErr } = await supabase
    .from('compliance_documents')
    .select('compliance_id')
    .eq('title', row.title)
    .eq('document_type', row.document_type)
    .eq('barangay_id', row.barangay_id)
    .eq('status', 'active')
    .maybeSingle();
  if (activeErr) throw activeErr;

  if (currentActive && currentActive.compliance_id !== row.compliance_id) {
    const { error: archiveErr } = await supabase
      .from('compliance_documents')
      .update({ status: 'archived' })
      .eq('compliance_id', currentActive.compliance_id);
    if (archiveErr) throw archiveErr;
  }

  const { data, error } = await supabase
    .from('compliance_documents')
    .update({ status: 'active' })
    .eq('compliance_id', complianceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}