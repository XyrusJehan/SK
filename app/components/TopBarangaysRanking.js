import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { computeStatus } from '../(tabs)/reportsApi';
import { supabase } from '../../utils/supabase';

// ─── HEROUI-INSPIRED DESIGN TOKENS ────────────────────────────────────────────
// Same tokens used in AnnualComplianceGraph.js / sk-dashboard.js so all three
// compliance widgets read as one consistent HeroUI-style system.
const HERO = {
  primary: '#133E75', primary50: '#EEF3FA',
  success: '#17C964', success50: '#EFFCF4', success600: '#12A150',
  warning: '#F5A524', warning50: '#FEF7EC', warning600: '#B45309',
  danger: '#EF4444', danger50: '#FEF2F2', danger600: '#B91C1C',
  gold: '#F5A524', gold50: '#FEF7EC',
  silver: '#71717A', silver50: '#F4F4F5',
  bronze: '#C2703D', bronze50: '#FDF3EC',
  default50: '#FAFAFA', default100: '#F4F4F5', default200: '#E4E4E7',
  default300: '#D4D4D8', default500: '#71717A', foreground: '#11181C',
  white: '#FFFFFF',
};

// Rank-badge styling for the top 3 spots (gold/silver/bronze), default beyond that
const RANK_STYLE = [
  { bg: HERO.gold50, color: HERO.gold },
  { bg: HERO.silver50, color: HERO.silver },
  { bg: HERO.bronze50, color: HERO.bronze },
];

// Compliance-rate chip color tier
const rateTier = (rate) => {
  if (rate >= 80) return { bg: HERO.success50, color: HERO.success600 };
  if (rate >= 50) return { bg: HERO.warning50, color: HERO.warning600 };
  return { bg: HERO.danger50, color: HERO.danger600 };
};

export default function TopBarangaysRanking() {
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearOptions, setYearOptions] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch the fiscal years actually configured in folder_year, newest first —
  // same source used by AnnualComplianceGraph's year selector — and default
  // to the most recent one.
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const { data, error } = await supabase
          .from('folder_year')
          .select('fiscal_year')
          .order('fiscal_year', { ascending: false });
        if (error) throw error;
        const years = (data || []).map((row) => String(row.fiscal_year));
        setYearOptions(years);
        setSelectedYear((prev) => (prev && years.includes(prev) ? prev : years[0] || null));
      } catch (e) {
        console.error('Failed to load fiscal years:', e);
      }
    };
    fetchYears();
  }, []);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      // 1️⃣ Fetch all barangays for name mapping
      const { data: barangays, error: bErr } = await supabase.from('barangays').select('barangay_id, barangay_name');
      if (bErr) throw bErr;
      const barangayMap = {};
      (barangays || []).forEach((b) => {
        barangayMap[b.barangay_id] = b.barangay_name;
      });

      // 2️⃣ Load deadlines for the chosen year (any barangay)
      const start = `${selectedYear}-01-01`;
      const end = `${selectedYear}-12-31`;
      const { data: deadlines, error: dErr } = await supabase
        .from('submission_deadlines')
        .select('deadline_id, barangay_id, document_type, deadline_date, is_met')
        .gte('deadline_date', start)
        .lte('deadline_date', end);
      if (dErr) throw dErr;

      // 3️⃣ Load documents (any barangay) – we only need the date fields to compute status
      const { data: documents, error: docErr } = await supabase
        .from('documents')
        .select('document_id, barangay_id, document_type, status, submitted_at, reviewed_at');
      if (docErr) throw docErr;

      // 4️⃣ Compute compliance per barangay
      const stats = {};
      (deadlines || []).forEach((dl) => {
        const barangayId = dl.barangay_id;
        if (!stats[barangayId]) stats[barangayId] = { total: 0, onTime: 0 };
        stats[barangayId].total++;

        const matchingDoc = (documents || []).find(
          (doc) => doc.barangay_id === barangayId && doc.document_type === dl.document_type
        );
        const actualDate = matchingDoc?.status === 'published'
          ? matchingDoc.submitted_at || matchingDoc.reviewed_at
          : null;
        const status = computeStatus(dl.deadline_date, actualDate);
        if (status === 'on_time') {
          stats[barangayId].onTime++;
        }
      });

      // 5️⃣ Transform into sortable array
      const rankingArray = Object.entries(stats).map(([id, s]) => ({
        barangayId: id,
        name: barangayMap[id] || 'Unknown',
        complianceRate: s.total ? Math.round((s.onTime / s.total) * 100) : 0,
        total: s.total,
        onTime: s.onTime,
      }));

      // Sort descending by complianceRate, then total submissions (to break ties)
      rankingArray.sort((a, b) => b.complianceRate - a.complianceRate || b.total - a.total);

      // Take top 5 (or 10 if you prefer – here we keep 5 as requested)
      setRanking(rankingArray.slice(0, 5));
    } catch (e) {
      console.error('Failed to load ranking:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedYear) return;
    fetchRanking();
    // eslint‑disable-next-line react-hooks/exhaustive-deps – fetchRanking defined inline
  }, [selectedYear]);

  return (
    <View style={rankingStyles.container}>
      <View style={rankingStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={rankingStyles.eyebrow}>BARANGAY RANKINGS</Text>
          <Text style={rankingStyles.title}>Top Barangays</Text>
          {!loading && selectedYear && (
            <Text style={rankingStyles.subtitle}>
              {ranking.length > 0 ? `Ranked by on-time submission rate · ${selectedYear}` : `No submissions for ${selectedYear}`}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={rankingStyles.yearScroll}
        contentContainerStyle={rankingStyles.yearPicker}
      >
        {yearOptions.map((y) => {
          const active = selectedYear === y;
          return (
            <TouchableOpacity
              key={y}
              style={[rankingStyles.yearOption, active && rankingStyles.yearOptionActive]}
              onPress={() => setSelectedYear(y)}
              activeOpacity={0.75}
            >
              <Text style={[rankingStyles.yearOptionText, active && rankingStyles.yearOptionTextActive]}>{y}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading || !selectedYear ? (
        <View style={rankingStyles.loadingWrap}>
          <ActivityIndicator color={HERO.primary} />
          <Text style={rankingStyles.loadingText}>Loading rankings…</Text>
        </View>
      ) : ranking.length === 0 ? (
        <View style={rankingStyles.emptyWrap}>
          <Text style={rankingStyles.emptyText}>No compliance data for this period.</Text>
        </View>
      ) : (
        <ScrollView style={rankingStyles.list} showsVerticalScrollIndicator={false}>
          {ranking.map((r, idx) => {
            const rankStyle = RANK_STYLE[idx] || { bg: HERO.default100, color: HERO.default500 };
            const tier = rateTier(r.complianceRate);
            return (
              <View
                key={r.barangayId}
                style={[rankingStyles.row, idx !== ranking.length - 1 && rankingStyles.rowBorder]}
              >
                <View style={[rankingStyles.rankBadge, { backgroundColor: rankStyle.bg }]}>
                  <Text style={[rankingStyles.rankBadgeText, { color: rankStyle.color }]}>{idx + 1}</Text>
                </View>
                <View style={rankingStyles.nameCol}>
                  <Text style={rankingStyles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={rankingStyles.nameMeta}>{r.onTime}/{r.total} on time</Text>
                </View>
                <View style={[rankingStyles.rateChip, { backgroundColor: tier.bg }]}>
                  <Text style={[rankingStyles.rateChipText, { color: tier.color }]}>{r.complianceRate}%</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const rankingStyles = StyleSheet.create({
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
    fontSize: 10, fontWeight: '700', color: HERO.default500,
    letterSpacing: 1.2, marginBottom: 2,
  },
  title: { fontSize: 16, fontWeight: '800', color: HERO.foreground },
  subtitle: { fontSize: 12, color: HERO.default500, marginTop: 3, fontWeight: '500' },

  // ── Year picker — HeroUI-style pill/segmented control ──
  yearScroll: { marginBottom: 14 },
  yearPicker: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  yearOption: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: HERO.default100, borderWidth: 1, borderColor: HERO.default200,
  },
  yearOptionActive: { backgroundColor: HERO.primary, borderColor: HERO.primary },
  yearOptionText: { fontSize: 12.5, fontWeight: '700', color: HERO.default500 },
  yearOptionTextActive: { color: HERO.white },

  // ── Loading / empty states ──
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  loadingText: { fontSize: 12.5, color: HERO.default500, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  emptyText: { fontSize: 13, color: HERO.default500, fontWeight: '500' },

  // ── Ranking rows ──
  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: HERO.default100 },
  rankBadge: {
    width: 28, height: 28, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rankBadgeText: { fontSize: 12.5, fontWeight: '800' },
  nameCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 13.5, fontWeight: '700', color: HERO.foreground },
  nameMeta: { fontSize: 11, color: HERO.default500, marginTop: 1, fontWeight: '500' },
  rateChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  rateChipText: { fontSize: 12, fontWeight: '800' },
});