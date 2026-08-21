import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ↔ يعكس بالظبط قيم app/(tabs)/_floating-tab-bar.tsx: `bottom: insets.bottom + 14`
// و`styles.pill`/`styles.searchCircle`'s `height: 32`. أي شاشة عندها محتوى
// عائم (position: absolute) قريب من أسفل الشاشة ولازم مايتغطّاش بشريط
// المهام العائم لازم تستخدم FLOATING_TAB_BAR_CLEARANCE بدل رقم ثابت
// عشوائي، عشان لو الشريط اتغيّر مقاسه فى مكان واحد يفضل الحساب هنا صح.
export const FLOATING_TAB_BAR_MARGIN = 14;
export const FLOATING_TAB_BAR_HEIGHT = 32;
export const FLOATING_TAB_BAR_CLEARANCE = FLOATING_TAB_BAR_MARGIN + FLOATING_TAB_BAR_HEIGHT;

// ↔ #2 (صفحة الريلز): الفجوة الصغيرة بين شريط الـ seek (bottom:0 داخل
// كارت الريل نفسه) وأعلى شريط المهام العائم — بدونها الشريطين بيبانوا
// ملزّقين فى بعض من غير أي هامش.
export const REEL_SEEK_BAR_GAP = 8;

// ↔ #2: كان فى كل من ReelCard.tsx و app/(tabs)/index.tsx ثابت محلي
// منفصل TAB_BAR_HEIGHT = 32 بيتحسب بيه ارتفاع الريل — رقم تقريبي مش
// بياخد باله من safe-area-insets.bottom (الموجودة فعليًا فى أي هاتف حديث
// بشريط سفلي/home indicator)، فكان ارتفاع الريل الفعلي أكبر من اللازم،
// وشريط الـ seek (اللي بيتحط على bottom:0 من كارت الريل) كان بينزل فعليًا
// جوه/تحت شريط المهام العائم بدل ما يقف فوقه. الدالة دي مصدر واحد مشترك
// للحساب الصحيح، بيتستخدم بالظبط بنفس القيمة فى الملفين التنين، فمقاس
// عنصر الـ FlatList (app/(tabs)/index.tsx) هيفضل مطابق تمامًا لمقاس
// الكارت اللي بيترندر (ReelCard.tsx) — أي فرق بينهم بيبوّظ الـ paging.
export function useReelHeight(): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return height - (insets.bottom + FLOATING_TAB_BAR_CLEARANCE + REEL_SEEK_BAR_GAP);
}
