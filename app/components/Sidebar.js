// ─────────────────────────────────────────────────────────────────────────
// Sidebar.js — shared sidebar module
//
// Drop this file in your components folder (e.g. `/components/Sidebar.js`)
// and import it from every screen that currently has its own copy-pasted
// `renderSidebar()` (sk-dashboard, sk-document, sk-planning, sk-portal,
// sk-logs, sk-account, …).
//
// This keeps the ORIGINAL layout you already had — navy background, 250px
// width, rounded pill nav items, white-filled active pill — and only
// polishes the details (softer inactive state, subtle active shadow,
// tighter spacing) so it feels a bit more refined without changing the
// color or size of anything.
//
// USAGE (inside any sk-*.js screen):
//
//   import Sidebar from '../../components/Sidebar';
//   ...
//   <Sidebar
//     activeTab={activeTab}
//     onNavPress={handleNavPress}
//     onLogout={handleLogout}
//     isMobile={isMobile}
//     sidebarVisible={sidebarVisible}
//   />
//
// `handleNavPress` / `handleLogout` are the same functions each screen
// already defines — nothing about your routing logic needs to change.
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Brand colors — same navy sk-dashboard already used ────────────────────
export const COLORS = {
  navy: '#133E75',
  white: '#FFFFFF',
  inactiveText: 'rgba(255,255,255,0.78)',
  inactiveIcon: 'rgba(255,255,255,0.78)',
};

// ─── NAV ICONS (unchanged from sk-dashboard — pure RN Views, no svg dep) ──

export const DashboardIcon = ({ color = '#fff', size = 16 }) => {
  const s = size * 0.38;
  const gap = size * 0.12;
  const r = size * 0.12;
  const box = { width: s, height: s, borderRadius: r, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap }}>
        <View style={box} />
        <View style={box} />
      </View>
      <View style={{ height: gap }} />
      <View style={{ flexDirection: 'row', gap }}>
        <View style={box} />
        <View style={box} />
      </View>
    </View>
  );
};

export const DocumentsIcon = ({ color = '#fff', size = 16 }) => {
  const w = size * 0.6, h = size * 0.78;
  const fold = size * 0.22;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: w, height: h, justifyContent: 'flex-end', paddingBottom: size * 0.08, paddingHorizontal: size * 0.1 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: fold, bottom: 0, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
        <View style={{ position: 'absolute', top: 0, right: 0, width: fold, height: fold, backgroundColor: color, borderBottomLeftRadius: size * 0.06 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, width: w - fold, height: fold, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, borderTopLeftRadius: size * 0.08 }} />
        <View style={{ height: 1.5, backgroundColor: color, borderRadius: 1, marginBottom: size * 0.1, width: '80%' }} />
        <View style={{ height: 1.5, backgroundColor: color, borderRadius: 1, width: '55%' }} />
      </View>
    </View>
  );
};

export const PlanningIcon = ({ color = '#fff', size = 16 }) => {
  const bw = 1.5;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: size * 0.82, height: size * 0.75, borderWidth: bw, borderColor: color, borderRadius: size * 0.1, overflow: 'hidden' }}>
        <View style={{ height: size * 0.22, backgroundColor: color, width: '100%' }} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: size * 0.05 }}>
          {[0, 1, 2].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />)}
        </View>
      </View>
      <View style={{ position: 'absolute', top: 0, flexDirection: 'row', gap: size * 0.32 }}>
        {[0, 1].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.2, backgroundColor: color, borderRadius: size * 0.05 }} />)}
      </View>
    </View>
  );
};

export const PortalIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

export const LogsIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.1, paddingHorizontal: size * 0.1, paddingVertical: size * 0.1, justifyContent: 'space-around' }}>
      <View style={{ position: 'absolute', top: -size * 0.08, alignSelf: 'center', width: size * 0.3, height: size * 0.14, backgroundColor: color, borderRadius: size * 0.04 }} />
      {[0, 1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.08, marginTop: i === 0 ? size * 0.1 : 0 }}>
          <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />
          <View style={{ flex: 1, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        </View>
      ))}
    </View>
  </View>
);

export const AccountIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, marginBottom: size * 0.04 }} />
    <View style={{ width: size * 0.72, height: size * 0.36, borderBottomLeftRadius: size * 0.36, borderBottomRightRadius: size * 0.36, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, overflow: 'hidden' }} />
  </View>
);

export const LogoutNavIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ position: 'absolute', left: 0, top: 0, width: size * 0.55, height: size, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.52, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.2, height: size * 0.2, borderTopWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }], marginTop: -size * 0.01 }} />
  </View>
);

// ── Default nav config — same tabs/routes sk-dashboard already used.
//    Override via the `navItems` prop on a screen-by-screen basis if needed. ──
export const NAV_ITEMS = [
  { tab: 'Dashboard', label: 'Dashboard', IconComponent: DashboardIcon, route: '/(tabs)/sk-dashboard' },
  { tab: 'Documents', label: 'Documents', IconComponent: DocumentsIcon, route: '/(tabs)/sk-document' },
  { tab: 'Planning',  label: 'Planning',  IconComponent: PlanningIcon,  route: '/(tabs)/sk-planning' },
  { tab: 'Portal',    label: 'Portal',    IconComponent: PortalIcon,    route: '/(tabs)/sk-portal' },
  { tab: 'Logs',      label: 'Logs',      IconComponent: LogsIcon,      route: '/(tabs)/sk-logs' },
  { tab: 'Account',   label: 'Account',   IconComponent: AccountIcon,   route: '/(tabs)/sk-account' },
];

// ─── SIDEBAR COMPONENT ──────────────────────────────────────────────────────
export default function Sidebar({
  activeTab,
  onNavPress,          // (tab) => void
  onLogout,             // () => void
  navItems = NAV_ITEMS,
  isMobile: isMobileProp,
  sidebarVisible = true,
  logoSource = require('./../../assets/images/sk-logo.png'),
}) {
  const isMobile = isMobileProp ?? SCREEN_WIDTH < 768;

  return (
    <View style={[styles.sidebar, isMobile && !sidebarVisible && styles.sidebarHidden]}>
      <View style={styles.logoPill}>
        <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
      </View>
      <View style={{ height: 24 }} />

      {navItems.map(({ tab, label, IconComponent }) => {
        const active = activeTab === tab;
        const iconColor = active ? COLORS.navy : COLORS.inactiveIcon;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => onNavPress?.(tab)}
            activeOpacity={0.8}
          >
            <View style={styles.navItemInner}>
              <IconComponent color={iconColor} size={16} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                {label ?? tab}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
        <View style={styles.navItemInner}>
          <LogoutNavIcon color={COLORS.inactiveIcon} size={16} />
          <Text style={styles.logoutText}>Logout</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── STYLES — same navy / same width, refined pill treatment ──────────────
const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 14,
    zIndex: 20,
  },
  sidebarHidden: { display: 'none' },

  logoPill: {
    marginTop: 20,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)',
  },
  logoImage: { width: 100, height: 100 },

  navItem: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    marginBottom: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navItemActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.inactiveText,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },

  logoutBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    marginTop: 8,
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.inactiveText,
    letterSpacing: 0.2,
  },
});
