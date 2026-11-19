// ESLint (flat config) backendi failidele. Frontendi failid jäävad frontendi
// arendaja hooleks, seega neid siin ei kontrollita.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export const BACKEND_FILES = [
  "backend/**/*.ts",
  "app/api/**/*.ts",
  "app/auth/**/*.ts",
  "middleware.ts",
];

export default tseslint.config(
  { ignores: ["node_modules", ".next", "coverage", "next-env.d.ts"] },
  {
    files: BACKEND_FILES,
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": ["warn", { allow: ["error"] }],
      eqeqeq: "error",
    },
  },
  {
    files: ["backend/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
