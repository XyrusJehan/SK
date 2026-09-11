import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { computeStatus } from '../(tabs)/reportsApi';
import { supabase } from '../../utils/supabase';

// ─── HEROUI-INSPIRED DESIGN TOKENS ────────────────────────────────────────────
// Same neutral scale + semantic colors used across the dashboard so this card
// reads as a HeroUI Card/Chip/Progress set, even though HeroUI itself only
// runs on web — this file stays plain React Native.
const HERO = {
  primary: '#133E75', primary50: '#EEF3FA',
  success: '#17C964', success50: '#EFFCF4', success600: '#12A150',
  warning: '#F5A524', warning50: '#FEF7EC', warning600: '#B45309',
  orange: '#F97316', orange50: '#FFF4ED', orange600: '#C2410C',
  danger: '#EF4444', danger50: '#FEF2F2', danger600: '#B91C1C',
  default50: '#FAFAFA', default100: '#F4F4F5', default200: '#E4E4E7',
  default300: '#D4D4D8', default500: '#71717A', foreground: '#11181C',
  white: '#FFFFFF',
};

const { width: SCREEN_W } = Dimensions.get('window');
const YEAR_MENU_WIDTH = 150;

// Status colors – kept for the underlying bucket logic, mapped to HERO below
const STATUS_COLORS = {
  complete: HERO.success,
  near: HERO.warning,
  missing: HERO.orange,
  overdue: HERO.danger,
};

const STATUS_META = {
  complete: { label: 'Complete / On-Time', icon: '✓', bg: HERO.success50, color: HERO.success600 },
  near: { label: 'Near Deadline', icon: '!', bg: HERO.warning50, color: HERO.warning600 },
  missing: { label: 'Missing Documents', icon: '?', bg: HERO.orange50, color: HERO.orange600 },
  overdue: { label: 'Overdue / Not Submitted', icon: '✕', bg: HERO.danger50, color: HERO.danger600 },
};

export default function AnnualComplianceGraph() {
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [counts, setCounts] = useState({ complete: 0, near: 0, missing: 0, overdue: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [yearFilters, setYearFilters] = useState(['All Years']);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [yearMenuAnchor, setYearMenuAnchor] = useState({ top: 0, left: 0 });
  const yearTriggerRef = useRef(null);

  // Measures the trigger's on-screen position so the dropdown (rendered in a
  // top-level Modal, above every other layer) can be anchored right beneath it.
  const openYearDropdown = () => {
    if (yearTriggerRef.current) {
      yearTriggerRef.current.measureInWindow((x, y, width, height) => {
        const left = Math.min(
          Math.max(8, x + width - YEAR_MENU_WIDTH),
          SCREEN_W - YEAR_MENU_WIDTH - 8
        );
        setYearMenuAnchor({ top: y + height + 6, left });
        setYearDropdownOpen(true);
      });
    } else {
      setYearDropdownOpen(true);
    }
  };

  // Fetch the fiscal years actually configured in folder_year, oldest first,
  // so the selector always matches the years the org has set up rather than
  // an assumed "current year + N past years" window. Defaults to the current
  // calendar year (falling back to "All Years" if it isn't configured yet).
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const { data, error } = await supabase
          .from('folder_year')
          .select('fiscal_year')
          .order('fiscal_year', { ascending: true });
        if (error) throw error;
        const years = (data || []).map((row) => String(row.fiscal_year));
        setYearFilters(['All Years', ...years]);
        const currentYear = String(new Date().getFullYear());
        setSelectedYear((prev) => {
          if (prev !== 'All Years' && years.includes(prev)) return prev;
          if (years.includes(currentYear)) return currentYear;
          return 'All Years';
        });
      } catch (e) {
        console.error('Failed to load fiscal years:', e);
      }
    };
    fetchYears();
  }, []);

  // Helper to fetch and aggregate data for the current filter
  const fetchData = async () => {
    setLoading(true);
    try {
      // Build date range for the chosen year (if any)
      let start = null;
      let end = null;
      if (selectedYear !== 'All Years') {
        const y = Number(selectedYear);
        start = `${y}-01-01`;
        end = `${y}-12-31`;
      }

      // 1️⃣ Fetch deadlines (the source of truth for when a document should be submitted)
      let deadlineQuery = supabase
        .from('submission_deadlines')
        .select('deadline_id, barangay_id, document_type, deadline_date, is_met, met_at');
      if (start && end) {
        deadlineQuery = deadlineQuery.gte('deadline_date', start).lte('deadline_date', end);
      }
      const { data: deadlines, error: dlErr } = await deadlineQuery;
      if (dlErr) throw dlErr;

      // 2️⃣ Fetch document submissions – we only need the fields needed for status calculation
      const { data: documents, error: docErr } = await supabase
        .from('documents')
        .select('document_id, barangay_id, document_type, status, submitted_at, reviewed_at');
      if (docErr) throw docErr;

      // 3️⃣ Compute status per deadline row and tally the four buckets
      const now = new Date();
      const bucket = { complete: 0, near: 0, missing: 0, overdue: 0, total: 0 };

      (deadlines || []).forEach((dl) => {
        const deadlineDate = dl.deadline_date ? new Date(dl.deadline_date) : null;
        // Find a matching document (same barangay & document type)
        const matchingDoc = (documents || []).find(
          (doc) => doc.barangay_id === dl.barangay_id && doc.document_type === dl.document_type
        );
        const actualDate = matchingDoc?.status === 'published'
          ? matchingDoc.submitted_at || matchingDoc.reviewed_at
          : null;
        const status = computeStatus(dl.deadline_date, actualDate);

        bucket.total++;
        if (status === 'on_time') {
          bucket.complete++;
        } else if (status === 'late') {
          bucket.overdue++;
        } else if (status === 'no_pub') {
          // Determine if the deadline has passed, is near, or is still far away
          if (!deadlineDate) {
            bucket.missing++;
          } else if (deadlineDate < now) {
            bucket.overdue++;
          } else {
            const diffDays = (deadlineDate - now) / (1000 * 60 * 60 * 24);
            if (diffDays <= 7) {
              bucket.near++;
            } else {
              bucket.missing++;
            }
          }
        }
      });

      setCounts(bucket);
    } catch (e) {
      console.error('Failed to load compliance data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Re‑fetch whenever the year selector changes
  useEffect(() => {
    fetchData();
    // eslint‑disable-next-line react-hooks/exhaustive-deps – fetchData defined inline
  }, [selectedYear]);

  // Helper to render a single status row — HeroUI-style: icon chip + label,
  // count chip on the right, full-width rounded progress track underneath.
  const renderBar = (key) => {
    const meta = STATUS_META[key];
    const count = counts[key];
    const total = counts.total || 1; // avoid division by zero
    const perc = Math.round((count / total) * 100);
    return (
      <View key={key} style={graphStyles.barItem}>
        <View style={graphStyles.barTopRow}>
          <View style={graphStyles.barLabelGroup}>
            <View style={[graphStyles.statusIcon, { backgroundColor: meta.bg }]}>
              <Text style={[graphStyles.statusIconText, { color: meta.color }]}>{meta.icon}</Text>
            </View>
            <Text style={graphStyles.barLabel}>{meta.label}</Text>
          </View>
          <View style={[graphStyles.countChip, { backgroundColor: meta.bg }]}>
            <Text style={[graphStyles.countChipText, { color: meta.color }]}>{count} · {perc}%</Text>
          </View>
        </View>
        <View style={graphStyles.barTrack}>
          <View style={[graphStyles.barFill, { backgroundColor: STATUS_COLORS[key], width: `${perc}%` }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={graphStyles.container}>
      <View style={graphStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={graphStyles.eyebrow}>COMPLIANCE OVERVIEW</Text>
          <Text style={graphStyles.title}>Annual Compliance Monitoring</Text>
          {!loading && (
            <Text style={graphStyles.subtitle}>
              {counts.total > 0 ? `${counts.total} tracked deadline${counts.total === 1 ? '' : 's'}` : 'No deadlines tracked yet'}
              {selectedYear !== 'All Years' ? ` · ${selectedYear}` : ''}
            </Text>
          )}
        </View>

        {/* ── HeroUI-style Select: year dropdown ── */}
        <View style={graphStyles.yearDropdownWrap}>
          <TouchableOpacity
            ref={yearTriggerRef}
            style={[graphStyles.yearTrigger, yearDropdownOpen && graphStyles.yearTriggerOpen]}
            onPress={() => (yearDropdownOpen ? setYearDropdownOpen(false) : openYearDropdown())}
            activeOpacity={0.75}
          >
            <Text style={graphStyles.yearTriggerText}>{selectedYear}</Text>
            <Text style={[graphStyles.yearTriggerChevron, yearDropdownOpen && graphStyles.yearTriggerChevronOpen]}>⌄</Text>
          </TouchableOpacity>

          {/* Rendered in a top-level Modal so it always paints above every
              other layer on the screen, instead of depending on local
              z-index/elevation stacking within the card. */}
          <Modal
            visible={yearDropdownOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setYearDropdownOpen(false)}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setYearDropdownOpen(false)}
            />
            <View
              style={[
                graphStyles.yearMenu,
                { position: 'absolute', top: yearMenuAnchor.top, left: yearMenuAnchor.left, width: YEAR_MENU_WIDTH },
              ]}
            >
              <ScrollView style={graphStyles.yearMenuScroll} showsVerticalScrollIndicator={false}>
                {yearFilters.map((y) => {
                  const active = selectedYear === y;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[graphStyles.yearMenuItem, active && graphStyles.yearMenuItemActive]}
                      onPress={() => { setSelectedYear(y); setYearDropdownOpen(false); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[graphStyles.yearMenuItemText, active && graphStyles.yearMenuItemTextActive]}>{y}</Text>
                      {active && <Text style={graphStyles.yearMenuCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Modal>
        </View>
      </View>

      {loading ? (
        <View style={graphStyles.loadingWrap}>
          <ActivityIndicator color={HERO.primary} />
          <Text style={graphStyles.loadingText}>Loading compliance data…</Text>
        </View>
      ) : counts.total === 0 ? (
        <View style={graphStyles.emptyWrap}>
          <Text style={graphStyles.emptyText}>No compliance data for this period.</Text>
        </View>
      ) : (
        <View style={graphStyles.bars}>
          {renderBar('complete')}
          {renderBar('near')}
          {renderBar('missing')}
          {renderBar('overdue')}
        </View>
      )}
    </View>
  );
}

const graphStyles = StyleSheet.create({
  container: {
    backgroundColor: HERO.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: HERO.default200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: HERO.default500,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: { fontSize: 16, fontWeight: '800', color: HERO.foreground },
  subtitle: { fontSize: 12, color: HERO.default500, marginTop: 3, fontWeight: '500' },

  // ── Year dropdown — HeroUI-style Select ──
  yearDropdownWrap: { flexShrink: 0 },
  yearTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: HERO.default50, borderWidth: 1, borderColor: HERO.default200,
  },
  yearTriggerOpen: { borderColor: HERO.primary, backgroundColor: HERO.primary50 },
  yearTriggerText: { fontSize: 12.5, fontWeight: '700', color: HERO.foreground },
  yearTriggerChevron: { fontSize: 12, color: HERO.default500, fontWeight: '700' },
  yearTriggerChevronOpen: { color: HERO.primary, transform: [{ rotate: '180deg' }] },

  yearMenu: {
    backgroundColor: HERO.white, borderRadius: 14,
    borderWidth: 1, borderColor: HERO.default200,
    paddingVertical: 6, elevation: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 16,
  },
  yearMenuScroll: { maxHeight: 220 },
  yearMenuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  yearMenuItemActive: { backgroundColor: HERO.primary50 },
  yearMenuItemText: { fontSize: 13, fontWeight: '600', color: HERO.foreground },
  yearMenuItemTextActive: { color: HERO.primary, fontWeight: '800' },
  yearMenuCheck: { fontSize: 12, fontWeight: '800', color: HERO.primary },

  // ── Loading / empty states ──
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  loadingText: { fontSize: 12.5, color: HERO.default500, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  emptyText: { fontSize: 13, color: HERO.default500, fontWeight: '500' },

  // ── Status rows ──
  bars: { gap: 16 },
  barItem: {},
  barTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  barLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statusIcon: {
    width: 22, height: 22, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  statusIconText: { fontSize: 11, fontWeight: '900', lineHeight: 12 },
  barLabel: { fontSize: 13, fontWeight: '700', color: HERO.foreground, flexShrink: 1 },
  countChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  countChipText: { fontSize: 11.5, fontWeight: '800' },

  barTrack: {
    height: 8,
    backgroundColor: HERO.default100,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
});