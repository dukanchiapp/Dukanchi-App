// Session 128.3: tiny haptic helper. Uses the web Vibration API which works
// inside the Android WebView (where the APK runs) and on web Chrome/Android.
// iOS Safari ignores Vibration silently — no-op. Capacitor Haptics would give
// iOS support too, but adding a native plugin means an APK rebuild — keep it
// web-only for now and revisit once we wire @capacitor/haptics for iOS.

type Strength = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const PATTERN: Record<Strength, number | number[]> = {
  light: 8,         // micro-tap (like, save, follow, share)
  medium: 15,       // confirm (publish, send message)
  heavy: 30,        // alert (delete confirm)
  success: [10, 50, 10],
  error: [25, 60, 25, 60, 25],
};

export function haptic(strength: Strength = 'light'): void {
  // `navigator.vibrate` is missing on iOS Safari + some embedded browsers;
  // wrapping in try/catch keeps us safe across all the WebView quirks.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN[strength]);
    }
  } catch {
    /* no-op — haptics are best-effort UX, never block a user action */
  }
}
