import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Switch } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useReelPreferences, CaptionsLanguage } from "../../lib/hooks/useReelPreferences";
import { usePiPPreference } from "../../lib/hooks/usePiPPreference";
import { PictureInPictureModal } from "../shared/PictureInPictureModal";
import { showToast } from "../shared/Toast";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenReport: () => void;
  // ↔ صوت الخلفية بيبان بس لو الريل ده فعليًا معاه موسيقى مرفقة
  // (property.music) — زي ما اتطلب بالظبط: "فى حالة ارفاق موسيقى للريل".
  hasMusic: boolean;
};

const CAPTION_LANGS: { key: CaptionsLanguage; label: string }[] = [
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

// ↔ القايمة المنسدلة اللي بتفتح بالضغط المطول على كارت وصف الريل —
// بتحل محل الـ ActionSheet البسيط اللي كان بس فيه "الإبلاغ عن هذا
// الريل" (لسه أول عنصر هنا). الأربع تفضيلات التانية (تمرير تلقائي، كتم
// صوت الخلفية، الترجمة النصية، وعرض التطبيق فوق التطبيقات الأخرى)
// بتتخزن/تتقرا من lib/hooks/useReelPreferences.ts وlib/hooks/usePiPPreference.ts
// — نفس المخازن اللي شاشة الإعدادات نفسها بتستخدمها، فأي تغيير من هنا
// أو من هناك بينعكس فى المكانين فورًا.
export function ReelOptionsSheet({ visible, onClose, onOpenReport, hasMusic }: Props) {
  const { t } = useLanguage();
  const {
    autoAdvance, setAutoAdvance,
    musicMuted, setMusicMuted,
    captionsEnabled, setCaptionsEnabled,
    captionsLanguage, setCaptionsLanguage,
  } = useReelPreferences();
  const { preference: pipPreference } = usePiPPreference();
  const [pipModalVisible, setPipModalVisible] = useState(false);

  if (!visible) return null;

  // ↔ قرار #3: التفعيل بيتخزن عادي (نفس سلوك ReelCaptionsOverlay.tsx —
  // بيعرض النص لو موجود فعلاً لريل معيّن)، بس بنوضّح صراحةً إن الترجمة
  // التلقائية AR↔EN لسه مش مدمجة، بدل ما نسيب المستخدم يفتكر إنها هتترجم
  // له تلقائيًا كل ريل.
  function handleToggleCaptions(next: boolean) {
    setCaptionsEnabled(next);
    if (next) showToast(t("الترجمة التلقائية قريباً — هتشتغل بس للريلز اللي معاها نص جاهز حاليًا"));
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Pressable style={styles.row} onPress={() => { onClose(); onOpenReport(); }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth={2}>
              <Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" />
            </Svg>
            <Text style={[styles.rowText, styles.rowTextDanger]}>{t("الإبلاغ عن هذا الريل")}</Text>
          </Pressable>

          <View style={styles.row}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2}>
              <Path d="M5 12h14M13 6l6 6-6 6" />
            </Svg>
            <Text style={styles.rowText}>{t("تمرير تلقائي")}</Text>
            <Switch value={autoAdvance} onValueChange={setAutoAdvance} trackColor={{ true: "#22A652" }} />
          </View>

          {hasMusic && (
            <View style={styles.row}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2}>
                {musicMuted ? (
                  <Path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                ) : (
                  <Path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                )}
              </Svg>
              <Text style={styles.rowText}>{t("صوت الخلفية")}</Text>
              <Switch value={!musicMuted} onValueChange={(on) => setMusicMuted(!on)} trackColor={{ true: "#22A652" }} />
            </View>
          )}

          <View style={styles.row}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2}>
              <Rect x={3} y={5} width={18} height={14} rx={2} />
              <Path d="M7 9h2M7 13h6" />
            </Svg>
            <Text style={styles.rowText}>{t("الترجمة النصية (Captions)")}</Text>
            <Switch value={captionsEnabled} onValueChange={handleToggleCaptions} trackColor={{ true: "#22A652" }} />
          </View>
          {captionsEnabled && (
            <View style={styles.captionLangRow}>
              {CAPTION_LANGS.map((lang) => (
                <Pressable
                  key={lang.key}
                  style={[styles.captionLangChip, captionsLanguage === lang.key && styles.captionLangChipActive]}
                  onPress={() => setCaptionsLanguage(lang.key)}
                >
                  <Text style={[styles.captionLangText, captionsLanguage === lang.key && styles.captionLangTextActive]}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.row} onPress={() => setPipModalVisible(true)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2}>
              <Rect x={3} y={3} width={18} height={14} rx={2} />
              <Rect x={12} y={11} width={7} height={5} rx={1} />
            </Svg>
            <Text style={styles.rowText}>{t("عرض التطبيق فوق التطبيقات الأخرى")}</Text>
            {pipPreference === "enabled" && <Text style={styles.rowBadge}>{t("مفعّل")}</Text>}
          </Pressable>

          <Pressable style={styles.cancelItem} onPress={onClose}>
            <Text style={styles.cancelItemText}>{t("إلغاء")}</Text>
          </Pressable>
        </View>
      </Modal>

      <PictureInPictureModal visible={pipModalVisible} onClose={() => setPipModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "white",
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingTop: 6,
  },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 20 },
  rowText: { fontSize: 13.5, fontWeight: "900", color: "#111", flex: 1 },
  rowTextDanger: { color: "#991B1B" },
  rowBadge: { fontSize: 11, fontWeight: "900", color: "#22A652" },
  captionLangRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 8, marginTop: -4 },
  captionLangChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#f3f4f6" },
  captionLangChipActive: { backgroundColor: "#22A652" },
  captionLangText: { fontSize: 12, fontWeight: "800", color: "#6b7280" },
  captionLangTextActive: { color: "white" },
  cancelItem: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  cancelItemText: { fontSize: 13.5, fontWeight: "900", color: "#6b7280" },
});
