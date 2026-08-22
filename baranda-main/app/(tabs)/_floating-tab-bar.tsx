import { I18nManager, View, Pressable, StyleSheet } from "react-native";
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
// ↔ #3/#4: هذا الشريط لازم يفضل بنفس الشكل والترتيب والحجم سواء التطبيق
// شغال بالعربي أو الإنجليزي (بعكس بقية الشاشة، اللي فيها الأيقونات الجانبية
// والوصف بيبدّلوا مكانهم حسب اللغة). الحل القديم كان يعتمد على الـ mirroring
// التلقائي بتاع I18nManager (يقلب flexDirection:"row" تلقائيًا وقت الـ RTL)
// وبيختار ترتيب JSX ثابت يتقلب مع اللغة — ده كان بيدّي ترتيب مختلف فعليًا
// بين العربي والإنجليزي، وده عكس المطلوب دلوقتي بالظبط.
// الحل هنا: نلغي أثر الـ mirroring التلقائي عمدًا بعكسه صراحةً —
// `flexDirection: I18nManager.isRTL ? "row-reverse" : "row"` — لأن أي
// flexDirection صريح برضه بيتقلب تلقائيًا مع RTL، فـ"row-reverse" وقت
// isRTL=true بيترجع يتقلب بصريًا لنفس شكل "row" العادي فى LTR. النتيجة:
// نفس الترتيب البصري بالظبط فى الحالتين. مفيش أي حاجة هنا بتعتمد على قيمة
// اللغة نفسها (ar/en) — بس على I18nManager.isRTL، فالسلوك ثابت مهما كانت
// اللغة الحالية.
export const BAR_ROUTES = ["requests", "menu", "index"] as const;
const ICON_COLOR = "#C9B896";
const ICON_COLOR_ACTIVE = "#F3E4BE";
const BAR_BG = "#26262A";
const FIXED_ROW_DIRECTION = I18nManager.isRTL ? "row-reverse" : "row";

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
      {/* ↔ #3: البيل (3 أيقونات) في منتصف الشاشة بالظبط دايمًا — مش
          معتمدة على مكان دائرة البحث، فمركزها ثابت مهما كانت اللغة. */}
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

      {/* ↔ #6: عدسة البحث الوحيدة فى شاشة الريلز دلوقتي — مثبتة فى مكان
          فيزيائي ثابت (right) بعيد عن أي mirroring، عشان تفضل فى نفس
          المكان بالظبط مهما كانت اللغة. */}
      <Pressable style={styles.searchCircle} onPress={() => go("search")} hitSlop={8}>
        <SearchSparkleIcon color={activeName === "search" ? "#FFE9B0" : "#D9B76B"} size={22} />
      </Pressable>
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
  // ↔ #3: عرض كامل بدل left/right:16 لأن البيل بقى بيتمركز جوه الحاوية دي
  // نفسها بالنص (alignItems:"center")، مش معتمد على توسيط يدوي بين عنصرين
  // متجاورين — كده منتصف الشريط = منتصف الشاشة فعليًا.
  wrap: {
    position: "absolute", left: 0, right: 0,
    alignItems: "center", justifyContent: "flex-end",
  },
  pill: {
    // ↔ #3: نفس الحجم بالظبط زي الأول (height: 32) وفى منتصف الشاشة دايمًا.
    // ↔ #4: flexDirection ثابت (مش "row" عادي) عشان يلغي أثر الـ RTL
    // mirroring التلقائي — الترتيب بصريًا بيفضل واحد فى العربي والإنجليزي.
    flexDirection: FIXED_ROW_DIRECTION, alignItems: "center", justifyContent: "center", gap: 4,
    height: 32, borderRadius: 16, backgroundColor: BAR_BG, paddingHorizontal: 10,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  tabBtn: { width: 34, alignItems: "center", justifyContent: "center", height: "100%" },
  // ↔ #4: "right" فيزيائي (مش start/end منطقي) فمكانها ثابت مهما كانت
  // اللغة — مفيش أي auto-mirroring بيأثر على قيم left/right الحرفية دي.
  searchCircle: {
    position: "absolute", right: 16, bottom: 4,
    width: 32, height: 32, borderRadius: 16, backgroundColor: BAR_BG,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
});
