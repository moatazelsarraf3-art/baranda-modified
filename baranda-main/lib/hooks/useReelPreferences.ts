import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ↔ الإعدادات الظاهرة فى القائمة المنسدلة اللي بتفتح بالضغط المطول على
// الريل (components/reel/ReelOptionsSheet.tsx):
//   - autoAdvance: "تمرير تلقائى" — تفضيل دائم (متخزّن)، زي اللغة/الثيم.
//   - musicMuted / captionsEnabled / captionsLang: دول بالتحديد لازم
//     "يتم إلغاؤها تلقائيًا عند الخروج من التطبيق وإغلاقه" حسب طلب
//     المستخدم — فعمدًا مش بيتخزنوا فى AsyncStorage، بس فى الذاكرة
//     (module-level state) زي أي متغيّر عادي: أي إغلاق حقيقي للتطبيق
//     (مش مجرد تصغيره فى الخلفية) بيصفّر الـ JS context بالكامل، فالقيم
//     دي بترجع للافتراضي (مش مكتومة / من غير captions) من تلقاء نفسها فى
//     المرة الجاية من غير أي كود إضافي.
export type CaptionsLanguage = "ar" | "en";

const AUTO_ADVANCE_STORAGE_KEY = "diarino:reelAutoAdvance";

interface ReelPreferencesSnapshot {
  autoAdvance: boolean;
  musicMuted: boolean;
  captionsEnabled: boolean;
  captionsLanguage: CaptionsLanguage;
}

let autoAdvance = true;
let musicMuted = false; // ↔ session-only — يرجع false تلقائيًا فى كل تشغيل جديد للتطبيق
let captionsEnabled = false; // ↔ session-only لنفس السبب
let captionsLanguage: CaptionsLanguage = "ar";

let snapshot: ReelPreferencesSnapshot = { autoAdvance, musicMuted, captionsEnabled, captionsLanguage };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { autoAdvance, musicMuted, captionsEnabled, captionsLanguage };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReelPreferencesSnapshot {
  return snapshot;
}

AsyncStorage.getItem(AUTO_ADVANCE_STORAGE_KEY).then((saved) => {
  if (saved === "0") {
    autoAdvance = false;
    emit();
  }
});

export function useReelPreferences() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  function setAutoAdvance(next: boolean) {
    autoAdvance = next;
    AsyncStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, next ? "1" : "0").catch(() => {});
    emit();
  }

  function setMusicMuted(next: boolean) {
    musicMuted = next;
    emit();
  }

  function setCaptionsEnabled(next: boolean) {
    captionsEnabled = next;
    emit();
  }

  function setCaptionsLanguage(next: CaptionsLanguage) {
    captionsLanguage = next;
    emit();
  }

  return {
    ...state,
    setAutoAdvance,
    setMusicMuted,
    setCaptionsEnabled,
    setCaptionsLanguage,
  };
}
