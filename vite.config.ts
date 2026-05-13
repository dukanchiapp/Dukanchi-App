import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({mode}) => {
  // loadEnv kept for future safe VITE_ prefixed vars; never expose secret keys here
  loadEnv(mode, '.', '');

  // Day 4 / Session 90 / Edit 11: conditional Sentry source-map upload.
  // Only enabled when SENTRY_AUTH_TOKEN is set at build time. Without the
  // token, the plugin is omitted from the plugins array entirely — Vite
  // build proceeds normally, just without source-map upload to Sentry.
  // Frontend Sentry still works (events arrive), but stack traces will
  // be minified/unreadable until source maps are uploaded.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const sentryPluginEnabled = !!(sentryAuthToken && sentryOrg && sentryProject);
  if (!sentryPluginEnabled && mode === 'production') {
    console.warn(
      '[observability] Sentry source-map upload disabled — set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT to enable.',
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false, // using our own public/manifest.json
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
      // Sentry source-map upload — conditionally appended. Must be LAST plugin
      // so it sees the final built bundles.
      ...(sentryPluginEnabled
        ? [
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: sentryOrg,
              project: sentryProject,
              // sourcemaps.assets uses Vite's default outDir (dist/)
              sourcemaps: {
                assets: './dist/**',
              },
              // Auto-discover release from git SHA in CI, else fall back
              release: {
                name: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
      },
      // Source maps required for Sentry to symbolicate stack traces.
      // Generated on every prod build; the Sentry plugin uploads them
      // (if its env vars are set) then they can be safely deleted from
      // the deployed artifact via `--delete-after-upload` (default behavior).
      sourcemap: true,
    },
  };
});
