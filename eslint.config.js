import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

// Nota: `react-hooks/set-state-in-effect` se desactiva porque AddressBar y
// BrowserView sincronizan intencionadamente estado local con props de forma
// síncrona dentro de efectos (patrón "adjust state when a prop changes").
// Ver TODO.md: el efecto de AddressBar con deps incompletas es un bug conocido.
export default tseslint.config(
  { ignores: ["dist", "src-tauri", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowExportNames: ["useTabs", "reducer", "initialState"] },
      ],
      "no-console": "warn",
    },
  },
);
