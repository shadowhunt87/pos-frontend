/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Dirección del sistema financiero (contabilidad), para los enlaces del administrador y el contador */
  readonly VITE_FINANCE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
