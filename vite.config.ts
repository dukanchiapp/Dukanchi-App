import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({mode}) => {
  // loadEnv kept for future safe VITE_ prefixed vars; never expose secret keys here
  loadEnv(mode, '.', '');

  // ── ND-D6-EXTRA-5 (Day 6 Phase 4): production build guard ─────────────
  // `.env.example` ships VITE_API_URL="http://localhost:3000" — a fresh
  // checkout that runs `npm run build` without overriding this would
  // produce a bundle that connects to a non-existent localhost in prod.
  //
  // Day 5.1's resolveApiBase() runtime fallback partially mitigates this,
  // but a build-time fail-fast is the right level — the configuration
  // mistake never reaches production artifacts.
  //
  // Fires only when:
  //   - mode === 'production' (Vite's build mode flag), AND
  //   - VITE_API_URL is SET and points to localhost / 127.0.0.1.
  // CI builds without VITE_API_URL set → guard skipped (no false positives).
  // `npm run build:mobile` overrides to https://dukanchi.com → guard passes.
  // `npm run dev` / `dev:web` use mode='development' → guard skipped.
  if (mode === 'production') {
    const apiUrl = process.env.VITE_API_URL || '';
    const looksLikeLocalhost =
      apiUrl.startsWith('http://localhost') ||
      apiUrl.startsWith('https://localhost') ||
      apiUrl.startsWith('http://127.0.0.1') ||
      apiUrl.startsWith('https://127.0.0.1');
    if (looksLikeLocalhost) {
      throw new Error(
        `[ND-D6-EXTRA-5] Production build aborted: VITE_API_URL points to localhost (${apiUrl}). ` +
          `Set VITE_API_URL to the production API origin (e.g., https://dukanchi.com) ` +
          `or use \`npm run build:mobile\` which sets it automatically. ` +
          `See README.md "Environment Variables" section.`,
      );
    }
  }

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
        // ND-A1 (Session 102a): switch generateSW → injectManifest so the
        // build emits dist/sw.js from src/sw.ts (which carries the push
        // handler). Previously generateSW overwrote public/sw.js, shipping
        // a Workbox SW without any push listener → web push silently dead.
        // Navigation denylist + Google Fonts runtimeCaching previously
        // configured here have been ported into src/sw.ts as code (Workbox
        // NavigationRoute + registerRoute calls). Native Capacitor push
        // unaffected — separate pathway.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
              // Auto-discover release from Fly's per-deploy release version,
              // else legacy Railway SHA (no-op on Fly), else undefined (lets
              // the plugin auto-generate a timestamp name). Keeping this in
              // sync with src/lib/sentry.ts ensures frontend sourcemap uploads
              // and backend runtime errors share the same release tag.
              release: {
                name:
                  process.env.FLY_RELEASE_VERSION ||
                  process.env.FLY_MACHINE_VERSION ||
                  process.env.RAILWAY_GIT_COMMIT_SHA ||
                  undefined,
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
