/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Toast helper installed by Layout; kinds: 'info' | 'error'. */
  toast?: (message: string, kind?: 'info' | 'error') => void;
}
