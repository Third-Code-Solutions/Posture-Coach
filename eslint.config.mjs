import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    name: "next/core-web-vitals",
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-sync-scripts": "error",
    },
  },
  ...tseslint.configs.recommended,
  globalIgnores([
    ".next/**",
    ".next-*/**",
    ".vercel/**",
    "next-env.d.ts",
    "out/**",
    "node_modules/**",
    "public/wasm/**",
    "public/models/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
