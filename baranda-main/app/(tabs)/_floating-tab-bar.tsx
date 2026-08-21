import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { RequestsIcon, MenuIcon as GridIcon, ReelsIcon, SearchSparkleIcon } from "./_tab-icons";

// ↔ the new floating bottom nav from the approved design: a dark pill
// holding three icons (طلبات / قائمة / رئيسية) plus a separate raised
// circular button for البحث, both floating above the screen content
// rather than docking to the bottom edge like the old full-width bar.
//
// This fully replaces the default <Tabs> tab bar via the `tabBar` prop,
// but only renders buttons for the four routes that belong in the bar —
// "account" is intentionally left out (its functions moved to the menu
// page's "إدارة الحساب" card) while its route file still works fine when
// reached via router.push, it's just not shown here.
//
// This one component is shared by every tab screen (index/search/menu/
// requests) via the `tabBar` prop on the <Tabs> navigator in
// app/(tabs)/_layout.tsx — so it's already a single, unified bar; there's
// no separate copy anywhere else to keep in sync.
//
// ↔ ordering fix: this used to counteract the automatic RTL mirroring
// with an explicit `direction: isAr ? "ltr" : "rtl"` style on the wrap —
// `direction` is a much newer, less consistently-supported RN/Yoga style
// property than the automatic row-mirroring I18nManager.isRTL already
// does everywhere else in the app. Rather than trust it to reliably
// override the mirroring on every device/RN version, the bar now just
// leans on that same automatic mirroring (already proven — it's what
// flips every other "row" in the app) by picking a *fixed* JSX order
// that reads correctly in each language's own natural reading direction:
// search first, then reels (home), then menu, then requests last. RTL
// mirrors that automatically to "search on the right, requests on the
// left"; LTR mirrors it to "search on the left, requests on the right" —
// exactly the "read right-to-left in Arabic / left-to-right in English,
// same relative order either way" the design asked for.
export const BAR_ROUTES = ["requests", "menu", "index"] as const;
const ICON_COLOR = "#C9B896";
const ICON_COLOR_ACTIVE = "#F3E4BE";
const BAR_BG = "#26262A";

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  function go(routeName: string) {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const isFocused = state.routes[state.index].name === routeName;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  const activeName = state.routes[state.index]?.name;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      <Pressable style={styles.searchCircle} onPress={() => go("search")} hitSlop={8}>
        <SearchSparkleIcon color={activeName === "search" ? "#FFE9B0" : "#D9B76B"} size={22} />
      </Pressable>

      <View style={styles.pill}>
        <TabButton active={activeName === "index"} onPress={() => go("index")}>
          <ReelsIcon color={activeName === "index" ? ICON_COLOR_ACTIVE : ICON_COLOR} size={22} />
        </TabButton>
        <TabButton active={activeName === "menu"} onPress={() => go("menu")}>
          <GridIcon color={activeName === "menu" ? ICON_COLOR_ACTIVE : ICON_COLOR} size={22} />
        </TabButton>
        <TabButton active={activeName === "requests"} onPress={() => go("requests")}>
          <RequestsIcon color={activeName === "requests" ? ICON_COLOR_ACTIVE : ICON_COLOR} size={22} />
        </TabButton>
      </View>
    </View>
  );
}

function TabButton({ children, onPress }: { children: React.ReactNode; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.tabBtn} onPress={onPress} hitSlop={8}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12,
  },
  pill: {
    // ↔ #2: كانت flex:1 (تمتد لكل العرض المتاح) وكل زرار جواها flex:1
    // كمان (justifyContent:"space-evenly")، فكانت المسافة الفعلية بين
    // الأيقونات كبيرة لأن كل زرار بياخد تلت العرض الواسع ده. دلوقتي
    // العرض بيتحدد حسب المحتوى نفسه (مفيش flex:1)، والأزرار بحجم ثابت
    // متلاصقة بـ gap صغير فى النص — نفس مكان شريط المهام زي الأول، بس
    // الأيقونات التلاتة (بيت/مربعات/طلبات) أقرب لبعض.
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    height: 32, borderRadius: 16, backgroundColor: BAR_BG, paddingHorizontal: 10,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  tabBtn: { width: 34, alignItems: "center", justifyContent: "center", height: "100%" },
  searchCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: BAR_BG,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
});
