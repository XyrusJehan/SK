// ─── REUSABLE MOBILE HEADER ───────────────────────────────────────────────────
//
// This header is rendered with `position: absolute` and `zIndex` high enough
// to sit on top of the scrollable content, so it stays pinned at the top of
// the screen on mobile and never scrolls away with the page.
//
// It is meant to be used by every SK and LYDO screen. Each screen still owns
// its own ScrollView; the header is just a sibling that floats above the top
// of that scrollable area. A spacer of equal height is rendered behind it so
// the content underneath starts in the right place (otherwise the first
// scroll row would be hidden under the header).
//
// Usage in a screen:
//
//   import MobileHeader from './mobileHeader';
//   ...
//   <View style={styles.layout}>
//     {isMobile && sidebarVisible && <SidebarOverlay />}
//     <Sidebar ... />
//     <View style={styles.main}>
//       <MobileHeader
//         title="Documents"
//         onMenuPress={() => setSidebarVisible(true)}
//         onBellPress={notif.open}
//         bellCount={notif.count}
//         BellIcon={BellIcon}
//         colors={COLORS}
//         hidden={isMobile && sidebarVisible}
//       />
//       <ScrollView contentContainerStyle={styles.mainContent}>
//         ... rest of the screen ...
//       </ScrollView>
//     </View>
//   </View>
//
// The component is intentionally a no-op on desktop (returns null) so screens
// can leave the import in place and render the same line everywhere without
// checking `isMobile` themselves.

import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_BAR_HEIGHT = 64; // height of the bar itself (below the status bar)
const isMobile = SCREEN_WIDTH < 768;

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    {[0, 1, 2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);

const MobileHeader = ({
  title = '',
  onMenuPress,
  onBellPress,
  bellCount = 0,
  BellIcon = null,
  hidden = false,
  colors = {
    navy:      '#133E75',
    cardBg:    '#FFFFFF',
    lightGray: '#ECECEC',
    darkText:  '#1A1A1A',
  },
}) => {
  const insets = useSafeAreaInsets();
  if (!isMobile) return null;

  // Reserve room at the top of the bar for the device status bar
  // (notch, clock, battery). On devices without a notch this is 0.
  const statusBarPad = insets?.top ?? 0;
  const totalHeight = HEADER_BAR_HEIGHT + statusBarPad;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, hidden && styles.wrapperHidden, { height: totalHeight }]}
    >
      <View style={[styles.statusBarPad, { height: statusBarPad, backgroundColor: colors.cardBg }]} />
      <View style={[styles.bar, { backgroundColor: colors.cardBg, borderBottomColor: colors.lightGray }]}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={onMenuPress}
          activeOpacity={0.7}
          accessibilityLabel="Open menu"
        >
          <MenuIcon />
        </TouchableOpacity>

        <Text
          style={[styles.title, { color: colors.darkText }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {BellIcon ? (
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={onBellPress}
            activeOpacity={0.7}
            accessibilityLabel="Open notifications"
          >
            <BellIcon count={bellCount} />
          </TouchableOpacity>
        ) : (
          <View style={styles.bellBtn} />
        )}
      </View>
    </View>
  );
};

// `Spacer` is the transparent view that should sit at the very top of every
// screen's ScrollView so the first row of content is not hidden behind the
// pinned header. It is intentionally a sibling — not part of the header —
// because the scroll container owns its own content offset.
//
// We use the same `useSafeAreaInsets` hook as the header itself so the
// spacer always matches the header's total height (bar + status bar pad),
// no matter which device the app is running on.
export const MobileHeaderSpacer = () => {
  const insets = useSafeAreaInsets();
  if (!isMobile) return null;
  const totalHeight = HEADER_BAR_HEIGHT + (insets?.top ?? 0);
  return <View style={{ height: totalHeight }} />;
};

export const MOBILE_HEADER_HEIGHT = HEADER_BAR_HEIGHT;

const styles = StyleSheet.create({
  wrapper: {
    // Pinned at the very top of the screen, above the scrollable area.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 8,
  },
  // When the drawer (sidebar) is open on mobile, lift the header out of
  // the way entirely — `display: none` removes it from the layout AND
  // the hit-testing region, so the bell button can't accidentally
  // intercept taps meant for the sidebar.
  wrapperHidden: { display: 'none' },
  // Transparent gap above the bar reserved for the device status bar
  // (notch, clock, battery). Its backgroundColor is set inline so the
  // status-bar area picks up the same surface color as the bar.
  statusBarPad: { width: '100%' },
  bar: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    // Subtle drop shadow so the bar reads as "above" the content when the
    // user scrolls.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconContainer: {
    width: 20,
    height: 16,
    justifyContent: 'space-between',
  },
  menuLine: {
    width: 20,
    height: 2,
    backgroundColor: '#133E75',
    borderRadius: 1,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MobileHeader;