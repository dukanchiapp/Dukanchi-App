# ─────────────────────────────────────────────────────────────────────────
# Dukanchi ProGuard / R8 keep rules — Phase C (Session 128.32)
#
# minifyEnabled + shrinkResources are ON in build.gradle (release). These keep
# rules stop R8 from stripping/renaming classes that are resolved REFLECTIVELY
# or across the JS↔native bridge — exactly the things a static reachability
# analysis can't see, and the usual cause of a "compiled fine, crashes on
# launch" minified build.
#
# ⚠️ This file makes the build SAFER but is not a guarantee — the real gate is
# the founder's on-device smoke test. If a stripped class still crashes the app,
# add a targeted -keep here, OR fall back to minifyEnabled false (see SESSION_LOG).
# ─────────────────────────────────────────────────────────────────────────

# ── Capacitor core + plugins ──
# Plugins are discovered/instantiated by name via reflection (capacitor.plugins.json
# → Class.forName), so their classes + members must survive minification.
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
# Cordova-bridged plugins (Capacitor wraps some Cordova plugins).
-keep class org.apache.cordova.** { *; }

# ── WebView JS bridge ──
# @JavascriptInterface methods are invoked by name from JS; R8 can't see those
# call sites and would otherwise strip/rename them → bridge calls fail silently.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Firebase / FCM + Google Play Services ──
# FCM (push-notifications) + google-services resolve classes reflectively at
# runtime. push is a core Dukanchi feature — keep these intact.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Attributes needed by the bridge + reflection + readable stack traces ──
# Annotations: Capacitor's @PluginMethod / @CapacitorPlugin discovery.
# Signature/InnerClasses/EnclosingMethod: generics + nested classes used by
# the plugin reflection. (SourceFile/LineNumberTable kept for triagable crash
# reports from a minified build.)
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable

# ── App entry points (referenced from AndroidManifest, not Kotlin/Java call sites) ──
-keep class com.dukanchi.app.** { *; }

# ── Enums (often (de)serialized by name across the bridge / Firebase) ──
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
