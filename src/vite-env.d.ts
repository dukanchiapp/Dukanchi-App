/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SHOW_PWA_PROMPTS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
