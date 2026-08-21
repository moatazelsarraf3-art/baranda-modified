import { View, Pressable, Text, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Property } from "../../lib/types";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useSellerContentSettings } from "../../lib/hooks/useContentSettings";
import { useSellerContactPhone } from "../../lib/hooks/useProperties";
import { openOrCreateChat } from "../../lib/hooks/useChatsDB";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { supabase } from "../../lib/supabase";
import { openExternalUrl } from "../../lib/linking";
import { phoneToWaMeDigits } from "../../lib/phone";

// ↔ استخرجت من app/property/[id].tsx — نفس المنطق بالضبط، لكن رقم
// الهاتف بقى بييجي من useSellerContactPhone (الدالة الآمنة الجديدة)
// بدل property.seller.phone اللي بقى فاضي دايمًا دلوقتي (شوف الكومنت
// فوق SELECT_DETAIL فى lib/hooks/useProperties.ts).
export function PropertyCtaBar({ property }: { property: Property }) {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const { data: sellerSettings } = useSellerContentSettings(property.seller.id);
  const { data: contactPhone } = useSellerContactPhone(property.id);

  function openWhatsapp() {
    if (!contactPhone) return;
    openExternalUrl(
      `https://wa.me/${phoneToWaMeDigits(contactPhone)}?text=${encodeURIComponent(`مهتم بعقارك: ${property.title}`)}`,
      t("تعذر فتح واتساب")
    );
    // Fire-and-forget: feeds the admin dashboard's "تحويلات واتساب" stat.
    supabase.rpc("increment_wa_clicks", { property_id: property.id }).then(({ error }) => {
      if (error) console.warn("Failed to record WhatsApp click:", error);
    });
  }

  async function openChat() {
    if (!user) return;
    // ↔ demo/seed listings (merged in from data/mock-properties.ts) have
    // a placeholder seller id that isn't a real auth user.
    const isRealSeller = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(property.seller.id);
    if (!isRealSeller) {
      Alert.alert(t("هذا إعلان تجريبي"), t("لا يمكن بدء محادثة مع هذا الإعلان."));
      return;
    }
    const chatId = await openOrCreateChat(user.id, property.seller.id, property.id);
    router.push(`/chat/${chatId}`);
  }

  return (
    <View style={styles.ctaBar}>
      {(sellerSettings?.chatOnProperties ?? true) && (
        <Pressable style={styles.chatBtn} onPress={openChat}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </Svg>
        </Pressable>
      )}
      {(sellerSettings?.showCallButton ?? true) && !!contactPhone && (
        <Pressable style={styles.chatBtn} onPress={() => openExternalUrl(`tel:${contactPhone}`, t("تعذر إجراء الاتصال"))}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 2 .7 3a2 2 0 01-.5 2.1L7.9 10.3a16 16 0 006 6l1.5-1.4a2 2 0 012.1-.5c1 .4 2 .6 3 .7a2 2 0 011.7 2z" />
          </Svg>
        </Pressable>
      )}
      {(sellerSettings?.showWhatsapp ?? true) && !!contactPhone && (
        <Pressable style={styles.whatsappBtn} onPress={openWhatsapp}>
          <Text style={styles.whatsappBtnText}>{t("تواصل عبر واتساب")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ctaBar: {
    flexDirection: "row", gap: 10, padding: 14, paddingBottom: 28,
    backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#f3f4f6",
  },
  chatBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: "#22A652", alignItems: "center", justifyContent: "center" },
  whatsappBtn: { flex: 1, backgroundColor: "#22A652", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  whatsappBtnText: { color: "white", fontWeight: "900", fontSize: 14 },
});
