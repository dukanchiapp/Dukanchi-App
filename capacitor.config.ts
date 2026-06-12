import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dukanchi.app',
  appName: 'Dukanchi',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    // Session 128.26 hardening: was true (dev leftover). With chrome://inspect
    // a connected ADB device could attach to the WebView and read all in-app
    // state (cookies, localStorage, etc.). Flip to false for release APKs.
    // androidScheme stays 'https' — Rule C N/A (no CORS audit needed).
    webContentsDebuggingEnabled: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,         // Hide programmatically — feels smoother
      backgroundColor: '#060814',    // Futuristic v2 deep-space background
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,            // No spinner — cleaner brand moment
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: '#060814',
      style: 'LIGHT',  // Light icons on deep-space dark background (futuristic v2)
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',                // Resize the webview body when keyboard appears
      style: 'DEFAULT',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
