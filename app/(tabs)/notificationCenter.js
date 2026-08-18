import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { BellIcon as HeroBellIcon } from 'react-native-heroicons/outline';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

const NAVY = '#133E75';
const WHITE = '#FFFFFF';
const DARK_TEXT = '#1A1A1A';
const SUB_TEXT = '#666666';

// ─── PERSISTED "SEEN" COUNTS ──────────────────────────────────────────────────
// The bell badge counts how many notifications are NEW since the user last
// opened the bell modal. Those seen counts are kept in AsyncStorage so they
// survive pull-to-refresh, screen re-mounts, and app restarts. Shared across
// every screen (keyed only by category, not by screen) so the badge stays in
// sync no matter where the user reads their notifications from.
const SEEN_KEYS = {
  approved:  'sk_notif_seen_approved',
  templates: 'sk_notif_seen_templates',
  returned:  'sk_notif_seen_returned',
  deadlines: 'sk_notif_seen_deadlines',
};

const loadSeenCounts = async () => {
  try {
    const entries = await Promise.all([
      AsyncStorage.getItem(SEEN_KEYS.approved),
      AsyncStorage.getItem(SEEN_KEYS.templates),
      AsyncStorage.getItem(SEEN_KEYS.returned),
      AsyncStorage.getItem(SEEN_KEYS.deadlines),
    ]);
    return {
      approved:  parseInt(entries[0] || '0', 10) || 0,
      templates: parseInt(entries[1] || '0', 10) || 0,
      returned:  parseInt(entries[2] || '0', 10) || 0,
      deadlines: parseInt(entries[3] || '0', 10) || 0,
    };
  } catch (err) {
    console.error('Error loading seen counts:', err);
    return { approved: 0, templates: 0, returned: 0, deadlines: 0 };
  }
};

const saveSeenCounts = async (counts) => {
  try {
    await Promise.all([
      AsyncStorage.setItem(SEEN_KEYS.approved,  String(counts.approved  || 0)),
      AsyncStorage.setItem(SEEN_KEYS.templates, String(counts.templates || 0)),
      AsyncStorage.setItem(SEEN_KEYS.returned,  String(counts.returned  || 0)),
      AsyncStorage.setItem(SEEN_KEYS.deadlines, String(counts.deadlines || 0)),
    ]);
  } catch (err) {
    console.error('Error saving seen counts:', err);
  }
};

// Supabase timestamps have no 'Z' suffix — JS mis-parses them as local time.
// toUtcDate forces correct UTC parsing before PHT display.
const toUtcDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const iso = String(dateStr).replace(' ', 'T').replace(/Z?$/, 'Z');
  return new Date(iso);
};

const toPhilippineDate = (dateStr, options) => {
  if (!dateStr) return '';
  const d = toUtcDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

const toPhilippineTime = (dateStr, options) => {
  if (!dateStr) return '';
  const d = toUtcDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

// Parse a Postgres `date` (YYYY-MM-DD) as a UTC midnight instant, avoiding
// local-timezone drift that could shift the day by ±1.
const parseDateOnly = (dateStr) => {
  const [y, m, d] = dateStr.toString().slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

// ─── DATA HOOK ────────────────────────────────────────────────────────────────
// Fetches everything the notification bell needs for a given barangay
// (returned/approved documents, forwarded templates, approaching deadlines),
// tracks per-category "seen" counts in AsyncStorage, and exposes bell-badge
// state plus the props NotificationModal needs. Re-fetches whenever the
// screen regains focus so every tab always shows the latest counts.
export function useNotificationCenter(barangayId) {
  const [visible, setVisible] = useState(false);

  const [seenApprovedCount, setSeenApprovedCount] = useState(0);
  const [seenTemplatesCount, setSeenTemplatesCount] = useState(0);
  const [seenReturnedCount, setSeenReturnedCount] = useState(0);
  const [seenDeadlinesCount, setSeenDeadlinesCount] = useState(0);
  const [seenLoaded, setSeenLoaded] = useState(false);

  const [returnedDocuments, setReturnedDocuments] = useState([]);
  const [approvedDocuments, setApprovedDocuments] = useState([]);
  const [forwardedTemplates, setForwardedTemplates] = useState([]);
  const [approachingDeadlines, setApproachingDeadlines] = useState([]);
  const [returnedProposalsCount, setReturnedProposalsCount] = useState(0);
  const [deadlinesCount, setDeadlinesCount] = useState(0);

  const [refreshKey, setRefreshKey] = useState(0);

  // Load persisted "seen" counts once on mount so the bell badge doesn't show
  // stale notifications as "new" after a refresh or app restart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSeenCounts();
      if (cancelled) return;
      setSeenApprovedCount(stored.approved);
      setSeenTemplatesCount(stored.templates);
      setSeenReturnedCount(stored.returned);
      setSeenDeadlinesCount(stored.deadlines);
      setSeenLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist seen counts to AsyncStorage whenever they change after the
  // initial load.
  useEffect(() => {
    if (!seenLoaded) return;
    saveSeenCounts({
      approved:  seenApprovedCount,
      templates: seenTemplatesCount,
      returned:  seenReturnedCount,
      deadlines: seenDeadlinesCount,
    });
  }, [seenLoaded, seenApprovedCount, seenTemplatesCount, seenReturnedCount, seenDeadlinesCount]);

  // Refresh whenever the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );

  // Fetch returned / approved documents + forwarded templates
  useEffect(() => {
    if (!barangayId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: documents, error } = await supabase
          .from('documents')
          .select('document_id, status, title, created_at, submitted_at, saved_at, reviewed_at')
          .eq('barangay_id', barangayId)
          .order('created_at', { ascending: false });

        if (error) { console.error('Error fetching documents for notifications:', error); return; }
        if (cancelled) return;

        const forRevision = documents?.filter(d => d.status === 'returned').length || 0;
        setReturnedProposalsCount(forRevision);

        setReturnedDocuments((documents || []).filter(d => d.status === 'returned').map(doc => ({
          id: doc.document_id,
          title: doc.title,
          created_at: doc.created_at,
          returned_at: doc.submitted_at || doc.saved_at,
          date: doc.submitted_at || doc.saved_at || doc.created_at,
        })));

        setApprovedDocuments((documents || []).filter(d => d.status === 'approved').map(doc => ({
          id: doc.document_id,
          title: doc.title,
          created_at: doc.created_at,
          approved_at: doc.reviewed_at || doc.submitted_at,
          date: doc.reviewed_at || doc.submitted_at || doc.created_at,
        })));
      } catch (err) {
        console.error('Error:', err);
      }

      try {
        const { data: distributions, error: distError } = await supabase
          .from('template_distributions')
          .select(`
            distribution_id,
            distributed_at,
            template_id,
            templates (
              template_id,
              title,
              template_category,
              version
            )
          `)
          .eq('barangay_id', barangayId)
          .order('distributed_at', { ascending: false });

        if (!distError && distributions && !cancelled) {
          setForwardedTemplates(distributions.map(d => ({
            id: d.distribution_id,
            title: d.templates?.title || 'Template',
            category: d.templates?.template_category || 'General',
            version: d.templates?.version || 1,
            distributed_at: d.distributed_at,
            date: d.distributed_at,
          })));
        }
      } catch (err) {
        console.error('Error fetching forwarded templates:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [barangayId, refreshKey]);

  // Fetch approaching deadlines
  useEffect(() => {
    if (!barangayId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: deadlines, error } = await supabase
          .from('submission_deadlines')
          .select('*')
          .eq('barangay_id', barangayId)
          .order('deadline_date', { ascending: true });

        if (error || cancelled) return;

        const notMetCount = (deadlines || []).filter(d => !d.is_met).length;
        setDeadlinesCount(notMetCount);

        const todayUtc = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        const approaching = (deadlines || [])
          .filter((d) => !d.is_met)
          .map((d) => {
            const deadlineUtc = parseDateOnly(d.deadline_date);
            const daysLeft = Math.round((deadlineUtc - todayUtc) / (24 * 60 * 60 * 1000));
            return {
              id: d.deadline_id.toString(),
              title: d.description || d.document_type,
              deadline: new Date(deadlineUtc).toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }),
              deadlineIso: d.deadline_date,
              daysLeft,
              urgent: daysLeft <= 3,
            };
          })
          .sort((a, b) => a.daysLeft - b.daysLeft);

        setApproachingDeadlines(approaching);
      } catch (err) {
        console.error('Error fetching deadlines for notifications:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [barangayId, refreshKey]);

  const seenReady = seenLoaded ? 1 : 0;
  const unviewedApproved  = seenReady ? Math.max(0, approvedDocuments.length  - seenApprovedCount)  : 0;
  const unviewedTemplates = seenReady ? Math.max(0, forwardedTemplates.length - seenTemplatesCount) : 0;
  const unviewedReturned  = seenReady ? Math.max(0, returnedProposalsCount   - seenReturnedCount)  : 0;
  const unviewedDeadlines = seenReady ? Math.max(0, deadlinesCount           - seenDeadlinesCount) : 0;

  const totalUnviewed = unviewedApproved + unviewedTemplates + unviewedReturned + unviewedDeadlines;

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const onViewCategory = useCallback((category) => {
    if (category === 'returned')  setSeenReturnedCount(returnedProposalsCount);
    if (category === 'approved')  setSeenApprovedCount(approvedDocuments.length);
    if (category === 'templates') setSeenTemplatesCount(forwardedTemplates.length);
    if (category === 'deadlines') setSeenDeadlinesCount(deadlinesCount);
  }, [returnedProposalsCount, approvedDocuments.length, forwardedTemplates.length, deadlinesCount]);

  const onMarkAllRead = useCallback(() => {
    setSeenApprovedCount(approvedDocuments.length);
    setSeenTemplatesCount(forwardedTemplates.length);
    setSeenReturnedCount(returnedProposalsCount);
    setSeenDeadlinesCount(deadlinesCount);
  }, [approvedDocuments.length, forwardedTemplates.length, returnedProposalsCount, deadlinesCount]);

  const modalProps = useMemo(() => ({
    visible,
    onClose: close,
    returnedDocuments,
    approvedDocuments,
    forwardedTemplates,
    approachingDeadlines,
    unviewedCounts: {
      returned: unviewedReturned,
      approved: unviewedApproved,
      templates: unviewedTemplates,
      deadlines: unviewedDeadlines,
    },
    onViewCategory,
    onMarkAllRead,
  }), [
    visible, close, returnedDocuments, approvedDocuments, forwardedTemplates, approachingDeadlines,
    unviewedReturned, unviewedApproved, unviewedTemplates, unviewedDeadlines, onViewCategory, onMarkAllRead,
  ]);

  return {
    visible,
    open,
    close,
    count: totalUnviewed,
    hasUnviewed: totalUnviewed > 0,
    modalProps,
  };
}

// ─── NOTIFICATION MODAL ──────────────────────────────────────────────────────
// Lists every notification relevant to the SK: documents returned by LYDO,
// documents approved by LYDO, templates forwarded by LYDO, and approaching
// submission deadlines. Rows are grouped by category via tab pills (with
// counts), each row shows a relative timestamp, and tapping a row deep-links
// to the relevant screen. Identical across every SK screen.
export function NotificationModal({
  visible,
  onClose,
  returnedDocuments,
  approvedDocuments,
  forwardedTemplates,
  approachingDeadlines,
  unviewedCounts = { returned: 0, approved: 0, templates: 0, deadlines: 0 },
  onMarkAllRead,
  onViewCategory,
  onOpenRoute,
}) {
  const TABS = ['all', 'returned', 'approved', 'templates', 'deadlines'];
  const [activeTab, setActiveTab] = useState('all');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDropdownVisible(false);
      setActiveTab('all');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && activeTab !== 'all' && onViewCategory) {
      onViewCategory(activeTab);
    }
  }, [visible, activeTab, onViewCategory]);

  const notifications = React.useMemo(() => {
    const items = [];

    (returnedDocuments || []).forEach((doc) => {
      items.push({
        id: `returned-${doc.id}`,
        type: 'returned',
        title: doc.title || 'Returned document',
        subtitle: 'Returned for revision',
        rawDate: doc.returned_at || doc.created_at,
        icon: '↩',
        accentBg: '#FFEDD5',
        iconColor: '#F97316',
      });
    });

    (approvedDocuments || []).forEach((doc) => {
      items.push({
        id: `approved-${doc.id}`,
        type: 'approved',
        title: doc.title || 'Approved document',
        subtitle: 'Approved by LYDO',
        rawDate: doc.approved_at || doc.created_at,
        icon: '✅',
        accentBg: '#DCFCE7',
        iconColor: '#22C55E',
      });
    });

    (forwardedTemplates || []).forEach((doc) => {
      items.push({
        id: `template-${doc.id}`,
        type: 'templates',
        title: doc.title || 'New template',
        subtitle: `New template received (v${doc.version || 1})`,
        rawDate: doc.distributed_at || doc.date,
        icon: '📄',
        accentBg: '#EDE9FE',
        iconColor: '#8B5CF6',
      });
    });

    (approachingDeadlines || []).forEach((item) => {
      items.push({
        id: `deadline-${item.id}`,
        type: 'deadlines',
        title: item.title || 'Upcoming deadline',
        subtitle:
          item.daysLeft < 0
            ? `${Math.abs(item.daysLeft)} days overdue`
            : item.daysLeft === 0
              ? 'Due today'
              : `${item.daysLeft} day${item.daysLeft !== 1 ? 's' : ''} left`,
        rawDate: item.deadlineIso || item.deadline,
        icon: '⏰',
        accentBg: item.urgent ? '#FEE2E2' : '#FEF3C7',
        iconColor: item.urgent ? '#EF4444' : '#F97316',
      });
    });

    return items.sort((a, b) => {
      const ta = a.rawDate ? toUtcDate(a.rawDate).getTime() : 0;
      const tb = b.rawDate ? toUtcDate(b.rawDate).getTime() : 0;
      return tb - ta;
    });
  }, [returnedDocuments, approvedDocuments, forwardedTemplates, approachingDeadlines]);

  const counts = React.useMemo(() => {
    const c = { all: notifications.length, returned: 0, approved: 0, templates: 0, deadlines: 0 };
    notifications.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, [notifications]);

  const badgeCounts = React.useMemo(() => {
    const returned  = unviewedCounts.returned  || 0;
    const approved  = unviewedCounts.approved  || 0;
    const templates = unviewedCounts.templates || 0;
    const deadlines = unviewedCounts.deadlines || 0;
    return { all: returned + approved + templates + deadlines, returned, approved, templates, deadlines };
  }, [unviewedCounts]);

  const filteredNotifications = React.useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const formatLongDate = (dateStr) => {
    if (!dateStr) return '';
    return toPhilippineDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTimeOfDay = (dateStr) => {
    if (!dateStr) return '';
    return toPhilippineTime(dateStr, { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelative = (dateStr) => {
    if (!dateStr) return '';
    const target = toUtcDate(dateStr);
    if (isNaN(target.getTime())) return '';
    const nowPh = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const targetPh = new Date(
      target.toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const diffMs = nowPh.getTime() - targetPh.getTime();
    if (diffMs < 0) return formatLongDate(dateStr);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDelta = Math.round((startOfDay(nowPh) - startOfDay(targetPh)) / (24 * 3600 * 1000));
    if (dayDelta === 1) return 'Yesterday';
    if (dayDelta < 7) return `${dayDelta}d ago`;
    return formatLongDate(dateStr);
  };

  const tabRoute = {
    returned: () => '/(tabs)/sk-document-management?initialTab=Returned',
    approved: () => '/(tabs)/sk-document-management?initialTab=Approved',
    templates: () => '/(tabs)/sk-portal',
    deadlines: () => '/(tabs)/sk-document-management?initialTab=Saved',
  }[activeTab];

  const handleRowPress = () => {
    const route = tabRoute ? tabRoute() : '/(tabs)/sk-document-management';
    if (onOpenRoute) onOpenRoute(route);
  };

  const handleMarkAllRead = () => {
    if (onMarkAllRead) onMarkAllRead();
  };

  const activeLabel =
    activeTab === 'all' ? 'All'
    : activeTab === 'returned' ? 'Returned'
    : activeTab === 'approved' ? 'Approved'
    : activeTab === 'templates' ? 'Templates'
    : 'Deadlines';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={notifModalStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={notifModalStyles.caret} />
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={notifModalStyles.modal}>
          <View style={notifModalStyles.header}>
            <View style={notifModalStyles.headerLeft}>
              <View style={notifModalStyles.headerIcon}>
                <Text style={notifModalStyles.headerIconText}>🔔</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={notifModalStyles.title}>Notifications</Text>
                <Text style={notifModalStyles.headerSub}>
                  {counts.all} update{counts.all !== 1 ? 's' : ''} from LYDO
                </Text>
              </View>
            </View>
            <View style={notifModalStyles.headerActions}>
              <TouchableOpacity
                style={notifModalStyles.markAllBtn}
                onPress={handleMarkAllRead}
                activeOpacity={0.8}
                disabled={counts.all === 0}
              >
                <Text style={notifModalStyles.markAllBtnText}>Mark all read</Text>
              </TouchableOpacity>
              <TouchableOpacity style={notifModalStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={notifModalStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={notifModalStyles.filterContainer}>
            <TouchableOpacity
              style={notifModalStyles.dropdownButton}
              onPress={() => setDropdownVisible(!dropdownVisible)}
              activeOpacity={0.8}
            >
              <View style={notifModalStyles.dropdownButtonLeft}>
                <Text style={notifModalStyles.dropdownButtonText}>{activeLabel}</Text>
                {badgeCounts[activeTab] > 0 && (
                  <View style={notifModalStyles.dropdownButtonBadge}>
                    <Text style={notifModalStyles.dropdownButtonBadgeText}>
                      {badgeCounts[activeTab] > 99 ? '99+' : badgeCounts[activeTab]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={notifModalStyles.dropdownArrow}>{dropdownVisible ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {dropdownVisible && (
              <View style={notifModalStyles.dropdownMenu}>
                {TABS.map((tab, idx) => {
                  const isActive = activeTab === tab;
                  const itemLabel =
                    tab === 'all' ? 'All'
                    : tab === 'returned' ? 'Returned'
                    : tab === 'approved' ? 'Approved'
                    : tab === 'templates' ? 'Templates'
                    : 'Deadlines';
                  const itemCount = badgeCounts[tab] || 0;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        notifModalStyles.dropdownItem,
                        isActive && notifModalStyles.dropdownItemActive,
                        idx < TABS.length - 1 && notifModalStyles.dropdownItemBorder,
                      ]}
                      onPress={() => { setActiveTab(tab); setDropdownVisible(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[notifModalStyles.dropdownItemText, isActive && notifModalStyles.dropdownItemTextActive]}>
                        {itemLabel}
                      </Text>
                      {itemCount > 0 && (
                        <View style={[notifModalStyles.dropdownItemBadge, isActive && notifModalStyles.dropdownItemBadgeActive]}>
                          <Text style={[notifModalStyles.dropdownItemBadgeText, isActive && notifModalStyles.dropdownItemBadgeTextActive]}>
                            {itemCount > 99 ? '99+' : itemCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={notifModalStyles.listContainer}>
            {filteredNotifications.length === 0 ? (
              <View style={notifModalStyles.emptyState}>
                <View style={notifModalStyles.emptyIconCircle}>
                  <Text style={notifModalStyles.emptyIcon}>🔕</Text>
                </View>
                <Text style={notifModalStyles.emptyText}>You're all caught up</Text>
                <Text style={notifModalStyles.emptySubText}>
                  {activeTab === 'all'
                    ? 'No updates from LYDO right now. New returned documents, approvals, templates, and deadline reminders will appear here.'
                    : `No ${activeLabel.toLowerCase()} updates right now.`}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={notifModalStyles.list}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={notifModalStyles.listContent}
              >
                {filteredNotifications.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={notifModalStyles.notifItem}
                    onPress={handleRowPress}
                    activeOpacity={0.7}
                  >
                    <View style={[notifModalStyles.notifIcon, { backgroundColor: item.accentBg }]}>
                      <Text style={[notifModalStyles.notifIconText, { color: item.iconColor }]}>{item.icon}</Text>
                    </View>
                    <View style={notifModalStyles.notifContent}>
                      <Text style={notifModalStyles.notifTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={[notifModalStyles.notifSubtitle, { color: item.iconColor }]} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                      <View style={notifModalStyles.notifMetaRow}>
                        <Text style={notifModalStyles.notifRelative}>{formatRelative(item.rawDate)}</Text>
                        {item.rawDate && (
                          <>
                            <Text style={notifModalStyles.notifDotSep}>•</Text>
                            <Text style={notifModalStyles.notifDate}>{formatLongDate(item.rawDate)}</Text>
                            <Text style={notifModalStyles.notifDotSep}>•</Text>
                            <Text style={notifModalStyles.notifTime}>{formatTimeOfDay(item.rawDate)}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Text style={notifModalStyles.notifChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── NOTIFICATION MODAL STYLES ─────────────────────────────────────────────────
const notifModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.25)',
    alignItems: 'flex-end',
    paddingTop: isMobile ? 58 : 84,
    paddingRight: isMobile ? 10 : 24,
  },
  caret: {
    width: 16, height: 16, backgroundColor: NAVY,
    borderTopLeftRadius: 3,
    transform: [{ rotate: '45deg' }],
    marginBottom: -8, marginRight: isMobile ? 18 : 26,
  },
  modal: {
    width: isMobile ? SCREEN_WIDTH - 20 : 400,
    height: isMobile ? 460 : 560,
    backgroundColor: WHITE, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 18,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: NAVY,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.3 },
  headerSub: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  markAllBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  markAllBtnText: { fontSize: 11, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, color: WHITE, fontWeight: '700' },

  filterContainer: {
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC',
    position: 'relative', zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: NAVY, borderRadius: 10,
  },
  dropdownButtonLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownButtonText: { fontSize: 14, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },
  dropdownButtonBadge: {
    minWidth: 22, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownButtonBadgeText: { fontSize: 11, fontWeight: '800', color: WHITE },
  dropdownArrow: { fontSize: 11, fontWeight: '800', color: WHITE },
  dropdownMenu: {
    position: 'absolute', top: 52, left: 16, right: 16,
    backgroundColor: WHITE, borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#F0F4FA' },
  dropdownItemText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  dropdownItemTextActive: { color: NAVY, fontWeight: '800' },
  dropdownItemBadge: {
    minWidth: 22, height: 18, borderRadius: 9,
    backgroundColor: '#EEF2F7', paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownItemBadgeActive: { backgroundColor: NAVY },
  dropdownItemBadgeText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  dropdownItemBadgeTextActive: { color: WHITE },

  listContainer: { flex: 1, backgroundColor: WHITE },
  list: { flex: 1 },
  listContent: { paddingVertical: 6 },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  notifIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifIconText: { fontSize: 18 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: DARK_TEXT, marginBottom: 2 },
  notifSubtitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  notifMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  notifRelative: { fontSize: 11.5, fontWeight: '700', color: SUB_TEXT },
  notifDotSep: { fontSize: 9, color: '#CBD5E1' },
  notifDate: { fontSize: 11, color: SUB_TEXT },
  notifTime: {
    fontSize: 11, fontWeight: '700', color: NAVY,
    fontVariant: ['tabular-nums'],
  },
  notifChevron: { fontSize: 22, color: '#94A3B8', marginLeft: 4, lineHeight: 22 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 16, fontWeight: '800', color: DARK_TEXT, marginBottom: 6 },
  emptySubText: {
    fontSize: 13, color: SUB_TEXT, textAlign: 'center',
    lineHeight: 19, maxWidth: 340,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── LYDO OFFICER NOTIFICATION CENTER ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// Everything below mirrors useNotificationCenter/NotificationModal above, but
// for the LYDO side of the app: a bell badge + dropdown listing documents SK
// officials have submitted for review. This is shared across every LYDO
// screen (dashboard, logs, monitor, barangay, etc.) so the badge count and
// "seen" state stay consistent no matter which screen the officer is on.

const LYDO_SEEN_KEY = 'lydo_notif_seen_submitted';

const loadLydoSeenCount = async () => {
  try {
    const stored = await AsyncStorage.getItem(LYDO_SEEN_KEY);
    return parseInt(stored || '0', 10) || 0;
  } catch (err) {
    console.error('Error loading LYDO seen count:', err);
    return 0;
  }
};

const saveLydoSeenCount = async (count) => {
  try {
    await AsyncStorage.setItem(LYDO_SEEN_KEY, String(count || 0));
  } catch (err) {
    console.error('Error saving LYDO seen count:', err);
  }
};

// ─── DATA HOOK ────────────────────────────────────────────────────────────────
// Fetches documents SK officials have submitted (status = 'submitted') for
// LYDO review, tracks the "seen" count in AsyncStorage, and exposes
// bell-badge state plus the props LydoNotificationModal needs. Re-fetches
// whenever the screen regains focus so every LYDO screen always shows the
// latest count.
export function useLydoNotificationCenter() {
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [seenSubmittedCount, setSeenSubmittedCount] = useState(0);
  const [seenLoaded, setSeenLoaded] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Load the persisted "seen" count once on mount so the bell badge doesn't
  // show stale notifications as "new" after a refresh or app restart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadLydoSeenCount();
      if (cancelled) return;
      setSeenSubmittedCount(stored);
      setSeenLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist the seen count to AsyncStorage whenever it changes after the
  // initial load.
  useEffect(() => {
    if (!seenLoaded) return;
    saveLydoSeenCount(seenSubmittedCount);
  }, [seenLoaded, seenSubmittedCount]);

  // Refresh whenever the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );

  // Fetch SK-submitted documents awaiting LYDO review.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: submittedDocs, error } = await supabase
          .from('documents')
          .select(`
            document_id,
            title,
            document_type,
            status,
            created_at,
            saved_at,
            submitted_at,
            barangay_id,
            barangays (barangay_name)
          `)
          .eq('status', 'submitted')
          .order('submitted_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          console.error('Error fetching SK submitted documents:', error);
          setItems([]);
        } else {
          setItems((submittedDocs || []).map((doc) => ({
            id: doc.document_id,
            title: doc.title || doc.document_type || 'Document',
            documentType: doc.document_type,
            barangay: doc.barangays?.barangay_name || 'Unknown Barangay',
            submittedAt: doc.submitted_at || doc.saved_at || doc.created_at,
          })));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Unexpected error fetching notifications:', err);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey]);

  const seenReady = seenLoaded ? 1 : 0;
  const unviewedSubmitted = seenReady ? Math.max(0, items.length - seenSubmittedCount) : 0;

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  // Called by the modal the moment it becomes visible — clears the badge
  // immediately, the same way viewing a category does on the SK side.
  const markViewed = useCallback(() => {
    setSeenSubmittedCount(items.length);
  }, [items.length]);

  const modalProps = useMemo(() => ({
    visible,
    onClose: close,
    items,
    loading,
    onViewed: markViewed,
  }), [visible, close, items, loading, markViewed]);

  return {
    visible,
    open,
    close,
    count: unviewedSubmitted,
    hasUnviewed: unviewedSubmitted > 0,
    modalProps,
  };
}

// ─── SHARED BELL ICON ─────────────────────────────────────────────────────────
// The bell glyph used in every screen's header (SK and LYDO alike) — Heroicons'
// outline bell, maroon-tinted, with a gold "unread" dot overlaid. Import this
// instead of redefining it in each screen file. Pair with `hasNotif={count > 0}`
// from the relevant notification-center hook (e.g. useLydoNotificationCenter()).
const BELL_MAROON = '#8B0000';
const BELL_GOLD = '#E8C547';

export const BellIcon = ({ hasNotif, size = 22, color = BELL_MAROON }) => (
  <View style={bellStyles.bellWrapper}>
    <HeroBellIcon size={size} color={color} strokeWidth={2} />
    {hasNotif && <View style={bellStyles.bellDot} />}
  </View>
);

// Back-compat alias in case other files still import the old LYDO-specific name.
export const LydoBellIcon = BellIcon;

const bellStyles = StyleSheet.create({
  bellWrapper: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: BELL_GOLD, borderWidth: 1.5, borderColor: WHITE },
});

// ─── LYDO NOTIFICATION MODAL ──────────────────────────────────────────────────
// Lists documents SK officials have submitted to LYDO for review. Each row
// shows the document title, source barangay, a status pill, and the
// submit date/time, with a "Review" button that deep-links to the reviewer.
// Identical across every LYDO screen.
export function LydoNotificationModal({
  visible,
  onClose,
  items = [],
  loading,
  onViewed,
  onReview,
}) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return toPhilippineDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return toPhilippineTime(dateStr, { hour: '2-digit', minute: '2-digit' });
  };

  // The moment the dropdown becomes visible, treat the current list as
  // viewed — this clears the bell badge immediately.
  useEffect(() => {
    if (visible && onViewed) {
      onViewed();
    }
  }, [visible, onViewed]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={lydoNotifModalStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={lydoNotifModalStyles.caret} />
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={lydoNotifModalStyles.modal}>
          <View style={lydoNotifModalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={lydoNotifModalStyles.title}>Notifications</Text>
              <Text style={lydoNotifModalStyles.subtitle}>
                Documents sent by SK Officials for review
              </Text>
            </View>
            <TouchableOpacity style={lydoNotifModalStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={lydoNotifModalStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={lydoNotifModalStyles.divider} />

          {loading ? (
            <View style={lydoNotifModalStyles.loadingState}>
              <ActivityIndicator color={NAVY} />
              <Text style={lydoNotifModalStyles.loadingText}>Loading notifications…</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={lydoNotifModalStyles.emptyState}>
              <Text style={lydoNotifModalStyles.emptyIcon}>🔔</Text>
              <Text style={lydoNotifModalStyles.emptyText}>No new notifications</Text>
              <Text style={lydoNotifModalStyles.emptySubText}>
                When SK officials send documents to your office, they will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={lydoNotifModalStyles.body}
              contentContainerStyle={lydoNotifModalStyles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={lydoNotifModalStyles.countLabel}>
                {items.length} document{items.length !== 1 ? 's' : ''} awaiting review
              </Text>
              {items.map((doc, idx) => (
                <View
                  key={doc.id}
                  style={[
                    lydoNotifModalStyles.itemRow,
                    idx < items.length - 1 && lydoNotifModalStyles.itemRowBorder,
                  ]}
                >
                  <View style={lydoNotifModalStyles.docIconBox}>
                    <Text style={lydoNotifModalStyles.docIcon}>📄</Text>
                  </View>
                  <View style={lydoNotifModalStyles.itemInfo}>
                    <Text style={lydoNotifModalStyles.itemTitle} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={lydoNotifModalStyles.itemMeta} numberOfLines={1}>
                      From: {doc.barangay}
                    </Text>
                    <View style={lydoNotifModalStyles.itemFooter}>
                      <View style={lydoNotifModalStyles.statusBadge}>
                        <Text style={lydoNotifModalStyles.statusText}>For Review</Text>
                      </View>
                      <View style={lydoNotifModalStyles.itemTime}>
                        <Text style={lydoNotifModalStyles.itemDate}>{formatDate(doc.submittedAt)}</Text>
                        <Text style={lydoNotifModalStyles.itemTimeText}>{formatTime(doc.submittedAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={lydoNotifModalStyles.reviewBtn}
                    activeOpacity={0.8}
                    onPress={() => onReview && onReview(doc)}
                  >
                    <Text style={lydoNotifModalStyles.reviewBtnText}>Review</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── LYDO NOTIFICATION MODAL STYLES ────────────────────────────────────────────
const LYDO_DARK_TEXT = '#1A2332';
const LYDO_SUB_TEXT = '#6B7A8F';
const LYDO_LIGHT_GRAY = '#ECECEC';
const LYDO_BLUE_LIGHT = '#DBEAFE';
const LYDO_ORANGE = '#F97316';
const LYDO_ORANGE_LIGHT = '#FEF3C7';

const lydoNotifModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.25)',
    alignItems: 'flex-end',
    paddingTop: isMobile ? 58 : 84,
    paddingRight: isMobile ? 10 : 24,
  },
  caret: {
    width: 16, height: 16, backgroundColor: NAVY,
    borderTopLeftRadius: 3,
    transform: [{ rotate: '45deg' }],
    marginBottom: -8, marginRight: isMobile ? 18 : 26,
  },
  modal: {
    backgroundColor: WHITE, borderRadius: 16,
    width: isMobile ? SCREEN_WIDTH - 20 : 400,
    height: isMobile ? 460 : 560,
    overflow: 'hidden', elevation: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 22,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: NAVY,
  },
  title: { fontSize: 16, fontWeight: '800', color: WHITE },
  subtitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },
  closeText: { fontSize: 12, fontWeight: '700', color: WHITE },
  divider: { height: 1, backgroundColor: LYDO_LIGHT_GRAY },
  body: { flex: 1 },
  bodyContent: { padding: 16, flexGrow: 1 },
  countLabel: {
    fontSize: 11, fontWeight: '700', color: LYDO_SUB_TEXT,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 10,
  },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: LYDO_LIGHT_GRAY },
  docIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: LYDO_BLUE_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  docIcon: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: LYDO_DARK_TEXT, marginBottom: 2 },
  itemMeta: { fontSize: 12, color: LYDO_SUB_TEXT, marginBottom: 6 },
  itemFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: LYDO_ORANGE_LIGHT,
  },
  statusText: { fontSize: 10, fontWeight: '700', color: LYDO_ORANGE },
  itemTime: { alignItems: 'flex-end' },
  itemDate: { fontSize: 11, color: LYDO_SUB_TEXT },
  itemTimeText: {
    fontSize: 12, fontWeight: '700', color: NAVY,
    fontVariant: ['tabular-nums'],
  },
  reviewBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: NAVY, backgroundColor: WHITE,
    flexShrink: 0,
    marginLeft: 6,
  },
  reviewBtnText: { fontSize: 11, fontWeight: '700', color: NAVY, letterSpacing: 0.2 },
  loadingState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10,
  },
  loadingText: { fontSize: 13, color: LYDO_SUB_TEXT },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '700', color: LYDO_DARK_TEXT, marginBottom: 4 },
  emptySubText: {
    fontSize: 13, color: LYDO_SUB_TEXT,
    textAlign: 'center', lineHeight: 18,
  },
});