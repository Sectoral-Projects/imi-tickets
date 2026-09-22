/// <reference path="../node_modules/vite/client.d.ts" />

declare module "*.md?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LEGAL_CONTACT?: string;
  readonly VITE_LEGAL_JURISDICTION?: string;
  readonly VITE_LEGAL_NAME?: string;
  readonly VITE_LEGAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
