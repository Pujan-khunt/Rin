/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly RIN_CLIENT_KEY?: string;
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
