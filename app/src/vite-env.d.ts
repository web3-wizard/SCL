/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORACLE_URL: string;
  readonly VITE_SCL_PROGRAM_ID: string;
  readonly VITE_SOLANA_CLUSTER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
