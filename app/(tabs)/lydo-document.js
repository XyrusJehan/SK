import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  navy:      '#133E75',
  navyDark:  '#0D2E5A',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F5F5F7',
  lightGray: '#E5E5EA',
  midGray:   '#AEAEB2',
  darkText:  '#1C1C1E',
  subText:   '#6D6D72',
  cardBg:    '#FFFFFF',
  border:    '#D1D1D6',
  folderBlue:'#1A8CFF',
  folderTop: '#1075D8',
    maroon:     '#8B0000',
  maroonDark: '#6B0000',
  gold:       '#E8C547',
  accent:     '#D4A017',
  white:      '#FFFFFF',
  offWhite:   '#F7F5F2',
  lightGray:  '#ECECEC',
  midGray:    '#B0B0B0',
  darkText:   '#1A1A1A',
  subText:    '#666666',
  teal:       '#2A7B7B',
  cardBg:     '#FFFFFF',
};

// ─── BARANGAY DATA ─────────────────────────────────────────────────────────────
const BARANGAYS = [
  { id: '1', name: 'San Roque',  docs: 5 },
  { id: '2', name: 'San Isidro', docs: 3 },
  { id: '3', name: 'San Bueno',  docs: 8 },
  { id: '4', name: 'Banot',      docs: 4 },
  { id: '5', name: 'Mamala',     docs: 6 },
  { id: '6', name: 'Taquico',    docs: 2 },
  { id: '7', name: 'Bayongon',   docs: 7 },
  { id: '8', name: 'Apasan',     docs: 5 },
];

// Sample documents per barangay
const SAMPLE_DOCS = [
  { id: '1', name: 'Resolution No. 2024-01.pdf',    type: 'pdf',   date: 'Jan 15, 2024', size: '1.2 MB' },
  { id: '2', name: 'Budget Report Q1.pdf',          type: 'pdf',   date: 'Feb 3, 2024',  size: '3.4 MB' },
  { id: '3', name: 'SK Members List.pdf',           type: 'pdf',   date: 'Mar 10, 2024', size: '0.8 MB' },
  { id: '4', name: 'Activity Documentation.jpg',    type: 'image', date: 'Apr 1, 2024',  size: '5.1 MB' },
  { id: '5', name: 'Minutes of Meeting.pdf',        type: 'pdf',   date: 'Apr 20, 2024', size: '0.5 MB' },
  { id: '6', name: 'Work Plan 2024.pdf',            type: 'pdf',   date: 'Jan 5, 2024',  size: '2.1 MB' },
  { id: '7', name: 'Project Proposal.pdf',          type: 'pdf',   date: 'Feb 18, 2024', size: '1.7 MB' },
  { id: '8', name: 'Event Report - Linggo.pdf',     type: 'pdf',   date: 'Mar 22, 2024', size: '0.9 MB' },
];

const NAV_TABS = ['Home', 'Documents', 'Monitor'];

// ─── MENU / BELL ICONS ────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={{ width: 20, height: 14, justifyContent: 'space-between' }}>
    {[0, 1, 2].map(i => (
      <View key={i} style={{ height: 2, backgroundColor: C.white, borderRadius: 1 }} />
    ))}
  </View>
);

const BellIcon = ({ hasNotif }) => (
  <View style={{ width: 20, height: 22, alignItems: 'center' }}>
    <View style={{ width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 }} />
    <View style={{ width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 }} />
    {hasNotif && (
      <View style={{ position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, borderWidth: 1.5, borderColor: C.white }} />
    )}
  </View>
);

// ─── macOS-STYLE FOLDER SVG (drawn with Views) ───────────────────────────────
const FolderIcon = ({ size = 72, selected = false }) => {
  const w = size;
  const h = size * 0.82;
  const tabW = w * 0.35;
  const tabH = h * 0.1;
  const bodyTop = tabH * 0.7;
  const bodyH = h - bodyTop;
  const blue = selected ? '#0055CC' : C.folderBlue;
  const blueTop = selected ? '#0044AA' : C.folderTop;
  const highlight = 'rgba(255,255,255,0.18)';

  return (
    <View style={{ width: w, height: h + 2 }}>
      {/* Folder tab */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: tabW, height: tabH + 4,
        backgroundColor: blueTop,
        borderTopLeftRadius: 4, borderTopRightRadius: 8,
      }} />
      {/* Folder body */}
      <View style={{
        position: 'absolute', top: bodyTop, left: 0,
        width: w, height: bodyH,
        backgroundColor: blue,
        borderRadius: 6,
        borderTopRightRadius: 6, borderTopLeftRadius: 2,
      }}>
        {/* Inner highlight */}
        <View style={{
          position: 'absolute', top: 4, left: 6, right: 6, height: bodyH * 0.3,
          backgroundColor: highlight, borderRadius: 4,
        }} />
      </View>
    </View>
  );
};

// ─── BARANGAY FOLDER CARD ─────────────────────────────────────────────────────
const FolderCard = ({ item, onPress, selected }) => (
  <TouchableOpacity
    style={[styles.folderCard, selected && styles.folderCardSelected]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <FolderIcon size={isMobile ? 64 : 72} selected={selected} />
    <Text style={[styles.folderName, selected && styles.folderNameSelected]} numberOfLines={2}>
      {item.name}
    </Text>
  </TouchableOpacity>
);

// ─── DOCUMENT ROW (inside a folder) ──────────────────────────────────────────
const DocRow = ({ doc }) => {
  const isPdf = doc.type === 'pdf';
  return (
    <TouchableOpacity style={styles.docRow} activeOpacity={0.7}>
      <View style={[styles.docIconWrap, { backgroundColor: isPdf ? '#FEE2E2' : '#DBEAFE' }]}>
        <Text style={{ fontSize: 18 }}>{isPdf ? '📄' : '🖼️'}</Text>
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
        <Text style={styles.docMeta}>{doc.date} · {doc.size}</Text>
      </View>
      <Text style={styles.docChevron}>›</Text>
    </TouchableOpacity>
  );
};

// ─── FOLDER CONTENTS MODAL ────────────────────────────────────────────────────
const FolderModal = ({ visible, barangay, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        {/* Handle */}
        <View style={styles.modalHandle} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <FolderIcon size={36} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.modalTitle}>{barangay?.name}</Text>
            <Text style={styles.modalSubtitle}>{barangay?.docs} documents</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={{ color: C.navy, fontWeight: '700', fontSize: 13 }}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalDivider} />

        {/* Documents */}
        <FlatList
          data={SAMPLE_DOCS.slice(0, barangay?.docs ?? 5)}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <DocRow doc={item} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Upload FAB */}
        <TouchableOpacity style={styles.modalFab}>
          <Text style={{ color: C.white, fontSize: 26, lineHeight: 30 }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─── SIDEBAR OVERLAY (mobile) ─────────────────────────────────────────────────
const SidebarOverlay = ({ visible, activeTab, onNav, onClose, logoLabel }) => {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={styles.sidebarBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sidebarDrawer}>
        <SidebarContent activeTab={activeTab} onNav={onNav} logoLabel={logoLabel} />
      </View>
    </View>
  );
};

// ─── SIDEBAR CONTENT ──────────────────────────────────────────────────────────
const SidebarContent = ({ activeTab, onNav, logoLabel }) => (
  <View style={styles.sidebar}>
    {/* Logo */}
    <View style={styles.logoPill}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>{logoLabel ?? 'SK'}</Text>
      </View>
    </View>
    <View style={{ height: 28 }} />
    {/* Nav items */}
    {NAV_TABS.map(tab => {
      const active = activeTab === tab;
      return (
        <TouchableOpacity
          key={tab}
          style={[styles.navItem, active && styles.navItemActive]}
          onPress={() => onNav(tab)}
          activeOpacity={0.8}
        >
          <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentsScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();

  const [search, setSearch]                 = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [modalVisible, setModalVisible]     = useState(false);

  useEffect(() => { setActiveTab('Documents'); }, []);

  const filtered = BARANGAYS.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home') router.push('/(tabs)/lydo-home');
    if (tab === 'Monitor') router.push('/(tabs)/monitor');
  };

  const openFolder = (item) => {
    setSelectedFolder(item);
    setModalVisible(true);
  };

  // ── DESKTOP layout ──────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.navy} />
        <View style={styles.layout}>

          {/* Sidebar */}
          <SidebarContent activeTab={activeTab} onNav={handleNav} logoLabel="SK" />

          {/* Main */}
          <ScrollView style={styles.main} contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
            {/* Desktop header */}
            <View style={styles.desktopHeader}>
              <View>
                <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
                <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
              </View>
              <TouchableOpacity style={styles.bellBtn}>
                <BellIcon hasNotif />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Search */}
            <View style={styles.searchWrap}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={C.midGray}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Text style={{ color: C.midGray, fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Section label */}
            <Text style={styles.sectionLabel}>All Documents</Text>

            {/* Folder Grid */}
            <View style={styles.folderGrid}>
              {filtered.map(item => (
                <FolderCard
                  key={item.id}
                  item={item}
                  selected={selectedFolder?.id === item.id}
                  onPress={() => openFolder(item)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        <FolderModal
          visible={modalVisible}
          barangay={selectedFolder}
          onClose={() => { setModalVisible(false); setSelectedFolder(null); }}
        />
      </SafeAreaView>
    );
  }

  // ── MOBILE layout ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />

      {/* Mobile sidebar overlay */}
      <SidebarOverlay
        visible={sidebarVisible}
        activeTab={activeTab}
        onNav={handleNav}
        onClose={() => setSidebarVisible(false)}
        logoLabel="SK"
      />

      {/* White content area */}
      <View style={[styles.main, { borderTopLeftRadius: 0, flex: 1 }]}>
        {/* Mobile top bar */}
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.mobileMenuBtn} onPress={() => setSidebarVisible(true)}>
            <View style={styles.mobileMenuBg}>
              <MenuIcon />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.mobileOrgSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.mobileOrgTitle}>RIZAL, LAGUNA</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
          <View style={styles.divider} />

          {/* Search */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={C.midGray}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={{ color: C.midGray, fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.sectionLabel}>All Documents</Text>

          {/* Mobile folder grid — 3 columns */}
          <View style={styles.folderGridMobile}>
            {filtered.map(item => (
              <FolderCard
                key={item.id}
                item={item}
                selected={selectedFolder?.id === item.id}
                onPress={() => openFolder(item)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <FolderModal
        visible={modalVisible}
        barangay={selectedFolder}
        onClose={() => { setModalVisible(false); setSelectedFolder(null); }}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebar: {
    width: 250, backgroundColor: '#133E75',
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10,
    zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  logoPill: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontWeight: '900', color: C.maroon, letterSpacing: 0.5 },
  sidebarSpacer: { height: 28 },
  navItem: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.white,
    backgroundColor: '#133E75',
  },
  navItemActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: '#000000',
    fontWeight: '800',
  },

  // ── Main ──
  main: { flex: 1, backgroundColor: C.white, borderTopLeftRadius: 20 },
  mainContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Desktop header
  desktopHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', paddingTop: 22, paddingBottom: 10,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: C.subText,
    letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: C.darkText, letterSpacing: 0.4 },

  // Mobile top bar
  mobileTopBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    backgroundColor: C.white,
  },
  mobileMenuBtn: { marginRight: 8 },
  mobileMenuBg: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
  },
  mobileOrgSub: {
    fontSize: 8, fontWeight: '700', color: C.subText,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  mobileOrgTitle: { fontSize: 14, fontWeight: '900', color: C.darkText, letterSpacing: 0.3 },

  // Bell
  bellBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3,
  },

  // Divider
  divider: { height: 1, backgroundColor: C.lightGray, marginBottom: 14 },

  // Search
  searchWrap: { marginBottom: 14 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.offWhite, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 9,
    width: isMobile ? '60%' : 220,   // matches screenshot — left-aligned, not full-width
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: C.darkText },

  // Section label
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: C.darkText,
    marginBottom: 16, letterSpacing: 0.2,
  },

  // ── Folder grid (desktop — 5 cols) ──
  folderGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 4,
  },

  // ── Folder grid (mobile — 3 cols) ──
  folderGridMobile: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 4,
  },

  // Folder card
  folderCard: {
    width: isMobile ? (SCREEN_WIDTH - 40 - 8) / 3 : 130,
    alignItems: 'center', padding: 10, borderRadius: 10,
    marginBottom: 4,
  },
  folderCardSelected: { backgroundColor: '#D6E4FF' },
  folderName: {
    marginTop: 6, fontSize: 11, fontWeight: '500',
    color: C.darkText, textAlign: 'center', lineHeight: 14,
  },
  folderNameSelected: { color: C.navy, fontWeight: '700' },

  // ── Document row (inside folder modal) ──
  docRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.lightGray,
  },
  docIconWrap: {
    width: 38, height: 38, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 13, fontWeight: '600', color: C.darkText },
  docMeta: { fontSize: 11, color: C.subText, marginTop: 2 },
  docChevron: { color: C.midGray, fontSize: 22 },

  // ── Folder Modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    height: '72%',
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: C.border, marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.darkText },
  modalSubtitle: { fontSize: 12, color: C.subText, marginTop: 2 },
  modalCloseBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#EAF0FF', borderRadius: 8,
  },
  modalDivider: { height: 1, backgroundColor: C.lightGray },
  modalFab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navy, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
});