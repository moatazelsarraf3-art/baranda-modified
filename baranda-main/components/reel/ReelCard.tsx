import { useEffect, useRef, useState, memo } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, ScrollView, BackHandler } from "react-native";
import { Image } from "expo-image";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import Svg, { Path } from "react-native-svg";
import { Property, getReelMode } from "../../lib/types";
import { ReelBackground } from "./ReelBackground";
import { ReelInfoOverlay } from "./ReelInfoOverlay";
import { ReelActionRail } from "./ReelActionRail";
import { ReelSeekBar } from "./ReelSeekBar";
import { startReelMusic, stopReelMusic } from "../../lib/musicPlayer";
import { cldOptimized, cldVideoThumbnail } from "../../lib/cloudinary";
import { PropertyDetailsContent } from "../property/PropertyDetailsContent";
import { PropertyCtaBar } from "../property/PropertyCtaBar";
import { useReelHeight } from "../../lib/uiConstants";

const BASE_SLIDE_MS = 4000; // ↔ currentReelSpeed default in app-viewer.html
const LONG_PRESS_MS = 500; // ↔ setTimeout(..., 500) in startLongPress()

// ↔ #1/#3: ارتفاع الريل بعد ما يتصغّر لفوق وقت فتح لوحة التفاصيل — نفس
// فكرة الـ mini-player بتاع الـ Shorts فى يوتيوب لما تفتح الكومنتات.
const MINI_MEDIA_HEIGHT = 220;
const SHEET_ANIM_MS = 280;

type Props = {
  property: Property;
  index: number;
  isActive: boolean; // this reel is the one currently in view (drives autoplay)
  // ↔ perf audit fix #1: index === activeIndex ± 1. Real <Video>/audio
  // playback only ever needs to exist for isActive; isNearActive exists
  // solely to decide whether a *video-mode* card mounts a real <Video>
  // player at all (vs. a static poster) — so the adjacent card is ready
  // to play instantly the moment a swipe lands on it, without every
  // other mounted card in the FlatList's window also paying for a live
  // decoder it will never use.
  isNearActive: boolean;
  isFollowing: boolean;
  isFavorite: boolean;
  isLiked: boolean;
  isComparing: boolean;
  // ↔ #2/#3: تفاصيل العقار بقت لوحة (bottom sheet) تفتح جوه شاشة الريلز
  // نفسها بدل ما تعمل navigation لصفحة تانية — عشان الريل يفضل شغال
  // ومسموع أثناء عرضها (نفس اليوتيوب شورتس). detailsOpen بييجي من الشاشة
  // الأب (فيه بس للكارت النشط فعليًا)، وonCloseDetails بيقفلها.
  detailsOpen: boolean;
  onCloseDetails: () => void;
  // ↔ perf audit fix #2: id/property-parameterized instead of pre-bound
  // no-arg closures. This is what lets the parent (app/(tabs)/index.tsx)
  // hand every card the exact same useCallback-memoized function
  // reference, which is required for React.memo below to actually skip
  // re-rendering cards whose own data hasn't changed.
  onOpenDetails: (propertyId: string) => void;
  onOpenSearch: () => void;
  onOpenSeller: (sellerId: string) => void;
  onToggleFollow: (sellerId: string) => void;
  onToggleFavorite: (propertyId: string) => void;
  onToggleLike: (propertyId: string) => void;
  onShare: (property: Property) => void;
  onToggleCompare: (propertyId: string) => void;
  onReport?: (property: Property) => void;
};

export const ReelCard = memo(function ReelCard({
  property, index, isActive, isNearActive, isFollowing, isFavorite, isLiked, isComparing,
  detailsOpen, onCloseDetails,
  onOpenDetails, onOpenSearch, onOpenSeller, onToggleFollow, onToggleFavorite, onToggleLike, onShare, onToggleCompare, onReport,
}: Props) {
  const reelHeight = useReelHeight();
  const mode = getReelMode(property);
  const videoRef = useRef<Video>(null);

  // ↔ toggleReelPause() — tap top/bottom half of the reel to pause/resume.
  const [paused, setPaused] = useState(false);

  // ↔ isLongPressing / currentReelSpeed — long-press anywhere (not on a
  // button or the seek bar) doubles playback speed while held.
  const [speed, setSpeed] = useState<1 | 2>(1);

  // ---- video state ----
  const [videoPosMs, setVideoPosMs] = useState(0);
  const [videoDurMs, setVideoDurMs] = useState(0);
  const video = mode === "video" ? property.media.find((m) => m.type === "video") : undefined;

  // ↔ #3: العقار الشغال يفضل شغال بالظبط زي ما كان (isActive && !paused)
  // — فتح لوحة التفاصيل مش بيغيّر paused، فالفيديو والصوت يفضلوا شغالين
  // من غير أي وقف حتى وهو مصغّر.
  useEffect(() => {
    if (mode !== "video" || !videoRef.current) return;
    videoRef.current.setStatusAsync({ shouldPlay: isActive && !paused, rate: speed, shouldCorrectPitch: true });
    return () => {
      videoRef.current?.setStatusAsync({ shouldPlay: false }).catch(() => {});
    };
  }, [isActive, paused, speed, mode]);

  function onVideoStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    setVideoPosMs(status.positionMillis ?? 0);
    setVideoDurMs(status.durationMillis ?? 0);
  }

  function seekVideo(pct: number) {
    if (!videoRef.current || !videoDurMs) return;
    videoRef.current.setPositionAsync(pct * videoDurMs);
  }

  // ---- slideshow state ↔ startSlideshow()/updateSlideshowSeek() ----
  const images = mode === "slideshow" ? property.media.filter((m) => m.type === "image") : [];
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideElapsedMs, setSlideElapsedMs] = useState(0);
  const slideTotalMs = images.length * BASE_SLIDE_MS;

  useEffect(() => {
    if (mode !== "slideshow" || images.length < 2 || !isActive || paused) return;
    const tickMs = 100;
    const interval = BASE_SLIDE_MS / speed;
    const id = setInterval(() => {
      setSlideElapsedMs((prev) => {
        const next = (prev + tickMs * speed) % (interval * images.length);
        setSlideIdx(Math.floor(next / interval) % images.length);
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [mode, images.length, isActive, paused, speed]);

  function seekSlideshow(pct: number) {
    const total = BASE_SLIDE_MS * images.length;
    const elapsed = pct * total;
    setSlideElapsedMs(elapsed);
    setSlideIdx(Math.min(images.length - 1, Math.floor(elapsed / BASE_SLIDE_MS)));
  }

  // ↔ maybePlayReelMusicFor() — only plays when there's no video (mode
  // 'none' or 'slideshow') and the property has a `music` track set, and
  // stops the moment this reel isn't the active/playing one, same as the
  // pause-tied start/stop in the original's toggleReelPause().
  useEffect(() => {
    const shouldPlay = mode !== "video" && !!property.music && isActive && !paused;
    if (shouldPlay) {
      startReelMusic(property.id, property.music);
    } else {
      stopReelMusic();
    }
    return () => {
      stopReelMusic();
    };
  }, [mode, property.music, property.id, isActive, paused]);

  function togglePause() {
    setPaused((v) => !v);
  }

  // ---- #1/#2/#3: لوحة تفاصيل العقار المصغّرة ----
  // ↔ detailsMounted يفضل true أثناء أنيميشن الإغلاق كمان (مش بس وهي
  // مفتوحة) عشان اللوحة تتحرك للأسفل وتختفي بالتدريج بدل ما تختفي فجأة،
  // وبعدين يتشال المكوّن فعليًا لما الأنيميشن يخلص (مفيش استعلامات شغالة
  // فى الخلفية من غير داعٍ وهي مقفولة).
  const [detailsMounted, setDetailsMounted] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (detailsOpen) {
      setDetailsMounted(true);
      Animated.timing(sheetAnim, {
        toValue: 1, duration: SHEET_ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 0, duration: SHEET_ANIM_MS, easing: Easing.in(Easing.cubic), useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setDetailsMounted(false);
      });
    }
  }, [detailsOpen, sheetAnim]);

  // ↔ زرار الرجوع فى أندرويد وهو فاتح اللوحة يقفلها بدل ما يسيب شاشة
  // الريلز بالكامل — متوقّع من أي "sheet" بيتفتح فوق شاشة قائمة.
  useEffect(() => {
    if (!isActive) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (detailsOpen) {
        onCloseDetails();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isActive, detailsOpen, onCloseDetails]);

  const mediaHeight = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [reelHeight, MINI_MEDIA_HEIGHT] });
  const sheetHeight = Math.max(reelHeight - MINI_MEDIA_HEIGHT, 0);
  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] });
  const mediaOverlayOpacity = sheetAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const miniHandleOpacity = sheetAnim;

  return (
    <View style={{ height: reelHeight, backgroundColor: "#000" }}>
      <Animated.View style={{ height: mediaHeight, width: "100%", overflow: "hidden", backgroundColor: "#000" }}>
        {mode === "video" && video && isNearActive ? (
          <Video
            ref={videoRef}
            source={{ uri: video.url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            isMuted={!isActive}
            onPlaybackStatusUpdate={onVideoStatus}
          />
        ) : mode === "video" && video ? (
          // ↔ perf audit fix #1: cards outside the active±1 window show a
          // static Cloudinary-derived poster frame instead of a live
          // <Video> player, so the FlatList's rendered window never has
          // more than 2-3 real video decoders allocated at once.
          <Image source={{ uri: cldVideoThumbnail(video.url) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : mode === "slideshow" && images.length > 0 ? (
          // ↔ #3: "من غير ما يقتصّه" — contentFit يتغيّر لـ contain وهو
          // مصغّر عشان الصورة تبان كاملة جوه المساحة الصغيرة، بدل ما
          // تتقصّ حواف زي وضع العرض العادي (cover).
          <Image source={{ uri: cldOptimized(images[slideIdx].url) }} style={StyleSheet.absoluteFill} contentFit={detailsMounted ? "contain" : "cover"} />
        ) : (
          <ReelBackground index={index} type={property.type} />
        )}

        {/* ↔ .reel-pause-indicator */}
        {paused && !detailsMounted && (
          <View style={styles.pauseIndicator} pointerEvents="none">
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="white">
              <Path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </Svg>
          </View>
        )}

        {/* ↔ .long-press-indicator */}
        {speed === 2 && !detailsMounted && (
          <View style={styles.longPressIndicator} pointerEvents="none">
            <Text style={styles.longPressText}>⚡ 2X</Text>
          </View>
        )}

        {!detailsMounted && (
          // ↔ .reel-tap-top / .reel-tap-bottom + startLongPress/endLongPress
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={togglePause}
            onLongPress={() => setSpeed(2)}
            delayLongPress={LONG_PRESS_MS}
            onPressOut={() => setSpeed(1)}
          />
        )}

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: mediaOverlayOpacity }]} pointerEvents={detailsMounted ? "none" : "box-none"}>
          <ReelInfoOverlay
            property={property}
            onOpenDetails={() => onOpenDetails(property.id)}
            onReport={onReport ? () => onReport(property) : undefined}
          />

          {mode === "video" && (
            <ReelSeekBar
              currentSec={videoPosMs / 1000}
              durationSec={videoDurMs / 1000}
              isPlaying={isActive && !paused}
              onTogglePlay={togglePause}
              onSeek={seekVideo}
            />
          )}
          {mode === "slideshow" && images.length > 1 && (
            <ReelSeekBar
              currentSec={slideElapsedMs / 1000}
              durationSec={slideTotalMs / 1000}
              isPlaying={isActive && !paused}
              onTogglePlay={togglePause}
              onSeek={seekSlideshow}
            />
          )}

          <ReelActionRail
            seller={property.seller}
            likes={property.likes}
            liked={isLiked}
            saved={isFavorite}
            following={isFollowing}
            comparing={isComparing}
            onOpenSearch={onOpenSearch}
            onOpenSeller={() => onOpenSeller(property.seller.id)}
            onToggleFollow={() => onToggleFollow(property.seller.id)}
            onToggleLike={() => onToggleLike(property.id)}
            onShare={() => onShare(property)}
            onToggleSave={() => onToggleFavorite(property.id)}
            onToggleCompare={() => onToggleCompare(property.id)}
          />
        </Animated.View>

        {/* ↔ mini-player: الضغط على الريل المصغّر يرجّعه كامل الشاشة تاني
            (زي الضغط على الـ mini-player بتاع يوتيوب شورتس عشان يتكبّر) */}
        {detailsMounted && (
          <Pressable style={StyleSheet.absoluteFill} onPress={onCloseDetails}>
            <Animated.View style={[styles.miniHandleWrap, { opacity: miniHandleOpacity }]} pointerEvents="none">
              <View style={styles.miniHandle} />
            </Animated.View>
          </Pressable>
        )}
      </Animated.View>

      {detailsMounted && (
        <Animated.View
          style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: sheetTranslateY }] }]}
        >
          <View style={styles.sheetGrabRow}>
            <View style={styles.sheetGrabHandle} />
            <Pressable style={styles.sheetCloseBtn} onPress={onCloseDetails} hitSlop={10}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2.5}>
                <Path d="M6 6l12 12M18 6L6 18" />
              </Svg>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            <PropertyDetailsContent property={property} />
          </ScrollView>
          <PropertyCtaBar property={property} />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  pauseIndicator: {
    position: "absolute", top: "50%", left: "50%", marginTop: -20, marginLeft: -20, opacity: 0.85,
  },
  longPressIndicator: {
    position: "absolute", top: "50%", left: "50%", marginTop: -16, marginLeft: -34,
    backgroundColor: "rgba(0,0,0,0.7)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, zIndex: 50,
  },
  longPressText: { color: "white", fontSize: 12, fontWeight: "900" },
  miniHandleWrap: { position: "absolute", top: 6, left: 0, right: 0, alignItems: "center" },
  miniHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.6)" },
  sheet: {
    backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  sheetGrabRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  sheetGrabHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: "#e5e7eb" },
  sheetCloseBtn: {
    position: "absolute", top: 8, right: 14, width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
  },
});
