# Deferred tasks

Tracked separately per the security-review follow-up decisions (LiveKit +
Expo Router audits, Aug 2026) so they don't get lost after launch. Each
entry links back to the report/decision that raised it.

## Completed

Accepted as 🟠 high-priority ("بعد القصوى مباشرة") in the same review
round that produced `is_public` RLS and the anonymous-broadcast
restriction. Both now done:

- [x] ~~Server-side rate limiting for live comments/likes~~ — shipped in
  `20260826000000_live_message_rate_limit.sql` +
  `supabase/functions/livekit-send-message`. Comments/likes now go
  through a server-checked, atomic Postgres counter before being relayed
  via LiveKit's `RoomServiceClient.sendData()`; `canPublishData` is
  `false` for everyone so there's no direct path left to bypass it. See
  README §7. The one follow-up noted here previously — scheduling
  `cleanup_old_rate_buckets()` — is now also done: `pg_cron` enabled +
  hourly job registered in `20260831000000_schedule_rate_bucket_cleanup.sql`
  (job name `cleanup-rate-buckets`, runs `0 * * * *`), plus a supporting
  index on `bucket_second` so the cleanup `DELETE` never has to scan the
  whole table. This item is now **fully closed**, nothing left open.
- [x] ~~Full RLS audit of the remaining Supabase tables~~ — done,
  table-by-table across all ~28 tables in `supabase/migrations/`. One
  real finding beyond what `20260822000000_rls_audit_fixes.sql` (an
  earlier audit round) had already caught: `known_regions` had no length
  cap on its otherwise-intentionally-open `with check (true)` INSERT
  policy — fixed in `20260827000000_known_regions_length_guard.sql`.
  Everything else checked out: ownership-scoped policies match their
  actual use (self-only tables, admin-gated tables via
  `admin_has_permission()`/staff-role checks, and the intentionally-public
  ones like `properties`/`lives`/`requests` all matched their product
  intent on inspection). Full findings in the chat transcript /
  consolidated report from this review round.

## Deferred to post-launch (explicitly, by product decision)

- [ ] **`lives.viewer_peak` trusted from the client** — a host can
  currently report an inflated number when ending their own broadcast
  (`app/live/broadcast.tsx`'s `finalizeSavedLive.mutate(...)`). Low
  severity (non-critical metadata, not PII/access). Fix: compute it
  server-side in `livekit-webhook` from `participant_joined`/
  `participant_left` events instead of trusting the broadcaster's own
  client. TODO comment already left at the call site.
- [ ] **Universal Links / App Links** for `https://diarino.app/...` share
  links to actually open the app (currently just open a browser — no
  `associatedDomains`/`intentFilters` configured in `app.json`). Product
  feature, not a security fix — noted in the Expo Router audit, no
  security surface either way since there's no custom deep-link handling
  code to exploit in the meantime.

## Accepted as-is (no action planned)

- **No distinction between anonymous ("guest") and real accounts**
  anywhere except starting a live broadcast (see README §7). Deliberate
  product decision to keep "try without signing in" fully functional
  everywhere else; RLS protects data regardless of which kind of session
  is asking, so this isn't a security gap, just a product-scope note.

---

# المهام المؤجَّلة بعد الإطلاق — دفعة تعديلات صفحة تفاصيل العقار/الإعدادات/الريلز

هذا القسم بيوثّق 3 قرارات اتخذها صاحب المنتج بتأجيل التنفيذ الكامل لحد
بعد الإطلاق، بدل ما تتنفّذ بشكل جزئي/مستعجل تحت ضغط. كل قسم فيه: الوضع
الحالي بالظبط، وايه المطلوب عمله، وأي تفاصيل تقنية لازم المطوّر اللي
هيكمل الشغل يعرفها.

## 1) الوضع الداكن (Dark Mode) — تغطية كل الشاشات

### الوضع الحالي
البنية التحتية شغالة بالكامل وحقيقية (مش مجرد تخزين تفضيل):
- `lib/hooks/useTheme.ts` — يخزّن التفضيل (فاتح/داكن/إعدادات الجهاز)
  وبينده على `Appearance.setColorScheme()` فعليًا، فـ `useColorScheme()`
  (اللي React Navigation والحوارات الأصلية زي `Alert` على iOS بتعتمد
  عليها) بتعكس اختيار المستخدم صح مش بس حالة نظام التشغيل.
- `lib/hooks/useThemeColors.ts` — توكينات ألوان حقيقية (`background`,
  `surface`, `card`, `border`, `text`, `textMuted`, `textSubtle`).

**الشاشات المُطبَّق عليها الثيم فعليًا (بتتغيّر ألوانها فعلاً):**
- `app/settings.tsx` — كاملة (الخلفية، الهيدر، الكروت، النصوص)
- `app/(tabs)/menu.tsx` — خلفية الصفحة (كروت القائمة نفسها متعمّد إنها
  تفضل بألوانها الثابتة اللي الأدمن حددها من لوحة التحكم — مصممة أصلاً
  تشتغل بصريًا على أي خلفية)
- `components/shared/PageTopBar.tsx` — مكوّن مشترك، فتلقائيًا بيغطي
  هيدر: `app/(tabs)/account.tsx`، `app/(tabs)/search.tsx`،
  `app/(tabs)/requests.tsx` (الهيدر بس — محتوى الصفحة نفسه لسه فاتح)

في `app/settings.tsx` فيه علامة "قيد التحسين" جنب صف "العرض" عشان توضح
للمستخدم إن التغطية لسه مش كاملة.

### الشاشات اللي لسه محتاجة نفس المعاملة (ألوان ثابتة فاتحة فى الـ StyleSheet بتاعها دلوقتي)

| الشاشة | ملاحظات |
|---|---|
| `app/(tabs)/index.tsx` (الريلز) | فيديو/صور fullscreen على خلفية سودة أصلاً — أولوية منخفضة |
| `app/(tabs)/account.tsx` | محتوى الصفحة (بعد الهيدر) |
| `app/(tabs)/search.tsx` | محتوى الصفحة (بعد الهيدر) |
| `app/(tabs)/requests.tsx` | محتوى الصفحة (بعد الهيدر) |
| `app/index.tsx` | شاشة تسجيل الدخول |
| `app/property/[id].tsx` + `components/property/*` | صفحة تفاصيل العقار بالكامل |
| `app/seller/[id].tsx` | صفحة البائع |
| `app/chat/*.tsx` | المحادثات |
| `app/live/*.tsx` | البث المباشر |
| `app/compare.tsx` | المقارنة |
| `app/publish/*.tsx` | نشر إعلان/طلب |
| `app/saved-alerts.tsx` | تنبيهاتي المحفوظة |
| `app/coming-soon.tsx` | صفحة "قريباً" |
| `components/account/*` (كل المودالات) | ThemeSelectorModal, LanguageSelectorModal, ContentSettingsModal... إلخ |
| `components/menu/*`, `components/notifications/*`, `components/requests/*`, `components/search/*` | كل المكوّنات المشتركة التانية |
| `app/admin/*` | لوحة التحكم — أولوية منخفضة (استخدام داخلي) |

### طريقة التنفيذ لكل شاشة (نفس النمط المستخدم فى settings.tsx/menu.tsx)
1. `import { useThemeColors } from "../lib/hooks/useThemeColors";`
2. `const themeColors = useThemeColors();` جوه الكومبوننت
3. استبدال أي `backgroundColor`/`color` ثابت (فاتح) بقيمة من `themeColors`
   — إما بتحويل الـ `StyleSheet.create()` الثابت لدالة `createStyles(themeColors)`
   زي `settings.tsx`، أو بعمل inline override بسيط
   `[styles.x, {backgroundColor: themeColors.card}]` زي `menu.tsx` —
   الأول أنضف لو الشاشة فيها ألوان كتير، والتاني أسرع لو قليلة.
4. الألوان الملوّنة المتعمّدة (كروت القائمة، أزرار العلامة التجارية
   الخضراء `#22A652`، شارات الحالة...) **تفضل زي ما هي** فى الوضعين —
   مش كل لون محتاج يتغيّر مع الثيم.

**تقدير الحجم:** حوالي 20 شاشة + 15-20 مكوّن مشترك، كل واحد محتاج مراجعة
يدوية للألوان (مفيش طريقة آلية آمنة تستبدل كل الألوان الثابتة من غير
مراجعة بصرية لكل شاشة).

## 2) عرض التطبيق فوق التطبيقات الأخرى (PiP حقيقي)

### الوضع الحالي
- `lib/hooks/usePiPPreference.ts` — تفضيل المستخدم (`enabled`/`declined`)
  متخزّن بشكل دائم (AsyncStorage)، مشترك بين `app/settings.tsx` وقايمة
  خيارات الريل (`components/reel/ReelOptionsSheet.tsx`).
- `components/shared/PictureInPictureModal.tsx` — مودال "تفعيل/ليس
  الآن"، ولما المستخدم يضغط "تفعيل" بيتحفظ التفضيل + يظهر توست "قريباً
  — هنفعّلها فى تحديث جاي".
- **مفيش تشغيل PiP فعلي دلوقتي** — التفضيل جاهز فورًا لما التكامل
  الـ native يتضاف.

### المطلوب تقنيًا لتفعيل PiP حقيقي

**الخطوة 1 — الترقية من `expo-av` لـ `expo-video`:**
مشغّل الفيديو الحالي (`components/reel/ReelCard.tsx`, `<Video>` من
`expo-av`) لا يدعم PiP على الإطلاق. `expo-video` عنده دعم PiP فعلي:
iOS عبر `allowsPictureInPicture` + `startPictureInPicture()`، وأندرويد
يحتاج خطوة إضافية (تحت). هذه ترقية أساسية فى محرك تشغيل الفيديو بالكامل
فى `ReelCard.tsx` — مش مجرد إضافة prop، لازم إعادة اختبار كل سلوكيات
الفيديو الحالية (تقدّم التشغيل، الكتم، السرعة 2x، إلخ).

**الخطوة 2 — إعدادات Android (config plugin):**
الـ Activity لازم يكون عندها `android:supportsPictureInPicture="true"`
و`android:resizeableActivity="true"` و`android:configChanges` مناسبة.
فى Expo managed workflow، ده محتاج config plugin مخصص بيعدّل
`AndroidManifest.xml` وقت الـ prebuild — يُرجع لـ
docs.expo.dev/config-plugins للتفاصيل الحالية وقت التنفيذ.

**الخطوة 3 — ربط الزر الفعلي:** لما المستخدم يسيب التطبيق والريل شغال،
لازم كود يستدعي دالة بدء الـ PiP بس لو
`usePiPPreference().preference === "enabled"`.

**ملحوظة:** صلاحية `SYSTEM_ALERT_WINDOW` الموجودة بالفعل فى `app.json`
خاصة بـ "الرسم فوق التطبيقات" مش PiP mode — مش هي المطلوبة هنا.

## 3) الترجمة النصية (Captions) — دمج حقيقي (Whisper + Translate)

### الوضع الحالي
- `supabase/migrations/20260904000000_reel_captions.sql` — عمودين
  `captions_ar`/`captions_en` (نص، nullable) على `properties`.
- `lib/types.ts` — `Property.captionsAr`/`captionsEn`.
- `components/reel/ReelCaptionsOverlay.tsx` — بيعرض النص الموجود فعليًا
  باللغة اللي المستخدم اختارها (أو المتاح لو مفيش باللغة المطلوبة)، من
  غير أي ترجمة تلقائية.
- `components/reel/ReelOptionsSheet.tsx` — عند تفعيل الخاصية، بيظهر
  توست "الترجمة التلقائية قريباً...".
- **العمودين فاضيين لكل الإعلانات الحالية** — محتاجين تفريغ صوتي حقيقي.

### دليل الدمج المستقبلي

**الخيار المقترح: OpenAI Whisper (تفريغ) + Google Cloud Translation أو
DeepL (ترجمة)**، عبر Supabase Edge Function.

**الخطوة 1 — Edge Function للتفريغ الصوتي** (مسار مقترح:
`supabase/functions/generate-captions/index.ts`):
- Trigger: بعد رفع فيديو جديد (webhook من Cloudinary أو بعد
  `INSERT`/`UPDATE` على `properties` لما `media` يحتوي فيديو)، أو زرار
  يدوي فى لوحة تحكم الأدمن.
- المنطق: (1) ياخد رابط الفيديو من Cloudinary، (2) يستخرج الصوت
  (Cloudinary بيقدر يحوّل لـ `.mp3` من نفس الفيديو مباشرة)، (3) يبعت
  الصوت لـ Whisper API (`POST /v1/audio/transcriptions`)، (4) يحفظ
  النص الناتج فى العمود المطابق للغة الأصلية المكتشفة.

**الخطوة 2 — الترجمة للغة التانية:** نفس الـ Edge Function (أو واحدة
منفصلة) تستدعي Google Cloud Translation API أو DeepL API وتملأ العمود
التاني (عربي→إنجليزي أو العكس).

**الخطوة 3 — متغيرات البيئة المطلوبة:**
```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GOOGLE_TRANSLATE_API_KEY=...
# أو بديل DeepL:
supabase secrets set DEEPL_API_KEY=...
```

**الخطوة 4 — التكلفة:** تسعير Whisper بالدقيقة الصوتية، وGoogle
Translate/DeepL بعدد الأحرف — يُرجع للتسعير الرسمي الحالي وقت التنفيذ.
فيديوهات الريلز عادةً قصيرة، فالتكلفة لكل ريل متوقع تكون صغيرة، لكن لازم
تتقاس فعليًا على حجم الاستخدام الحقيقي قبل الإطلاق الكامل للخاصية.

**الخطوة 5 — بعد ما البيانات تتملي:** مفيش تعديل مطلوب فى
`ReelCaptionsOverlay.tsx` ولا `ReelOptionsSheet.tsx` — جاهزين بالفعل
يعرضوا أي نص موجود. الخطوة المتبقية بس: تشغيل الـ Edge Function دي
وإزالة رسالة "قريباً" من دالة `handleToggleCaptions` فى
`ReelOptionsSheet.tsx`.

## ملخص سريع

| البند | الملفات الأساسية | حجم المجهود التقديري |
|---|---|---|
| الوضع الداكن الكامل | ~35 ملف (شاشات + مكوّنات) | كبير — تدريجي، شاشة بشاشة |
| PiP حقيقي | `ReelCard.tsx` (ترقية expo-video) + config plugin جديد | متوسط-كبير — يحتاج ترقية محرك فيديو كامل |
| الترجمة/الكابشنز | Edge Function جديدة + مفاتيح API خارجية | متوسط — مافيش تعديل مطلوب فى الفرونت إند |
