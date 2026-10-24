/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
  readonly VITE_API_URL?: string
  /** Set to "true" in .env.local to show the helpdesk alert test floater in dev */
  readonly VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.json' {
  const value: Record<string, unknown>
  export default value
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

// Type declaration for process.env (used in DEV-ONLY guards)
declare const process: {
  env: {
    NODE_ENV: string;
  };
};
