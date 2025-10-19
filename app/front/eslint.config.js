import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import * as importPlugin from "eslint-plugin-import";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ERROR = "error";
const OFF = "off";
const WARN = "warn";

export default tseslint.config(
    {
      ignores: [
        "dist",
        "config/**",
        "deploy/**",
        ".husky/**",
        "public/**",
        "scripts/**",
        "src/vite-env.d.ts",
        "**/*.css",
        "**/*.scss",
        "build/**",
        "vite.config.ts",
        "eslint.config.js",
        ".prettierrc.config.mjs",
      ],
    },
    {
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
        parser: tseslint.parser,
        parserOptions: {
          project: null,
        },
      },
      plugins: {
        "react-hooks": reactHooks,
        "react-refresh": reactRefresh,
        import: importPlugin,
      },
      settings: {
        "import/parsers": {
          "@typescript-eslint/parser": [".ts", ".tsx"],
        },
        "import/resolver": {
          typescript: {
            alwaysTryTypes: true,
            project: "./tsconfig.json",
            tsconfigRootDir: __dirname,
          },
          node: {
            extensions: [".js", ".jsx", ".ts", ".tsx"],
          },
        },
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        "react-refresh/only-export-components": [
          WARN,
          { allowConstantExport: true },
        ],
        "@typescript-eslint/ban-ts-comment": OFF,
        semi: OFF,
        strict: OFF,
        "prefer-const": ERROR,
        "react-hooks/exhaustive-deps": OFF,
        "react-hooks/rules-of-hooks": OFF,
        "@typescript-eslint/no-inferrable-types": OFF,
        "@typescript-eslint/no-var-requires": OFF,

        "import/order": [
          WARN, // Понижаем до предупреждения вместо ошибки
          {
            "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
            "warnOnUnassignedImports": true,
            "pathGroups": [

              { "pattern": "react", "group": "external" },
              { "pattern": "react-*", "group": "external" },
              { "pattern": "@mantine/**", "group": "external" },
              { "pattern": "mobx*", "group": "external" },
              { "pattern": "@xyflow/**", "group": "external" },

              { "pattern": "*.css", "group": "index", "position": "after" },
              { "pattern": "*.scss", "group": "index", "position": "after" },
              { "pattern": "*.module.scss", "group": "index", "position": "after" }
            ],
            "alphabetize": {
              "order": "asc",
              "caseInsensitive": true
            },
            "newlines-between": "never"
          }
        ],

        "import/no-unresolved": OFF,
        "import/no-cycle": OFF,
        "import/no-duplicates": ERROR,

        "no-trailing-spaces": [ERROR, { ignoreComments: true }],
        indent: [ERROR, 2, { ignoredNodes: ["PropertyDefinition[decorators]"] }],
        "jsx-a11y/anchor-is-valid": [OFF],
      },
    }
);
