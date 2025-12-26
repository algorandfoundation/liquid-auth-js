import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslintEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["src/hi-base32.ts", "src/sha512.ts"]), {
    extends: compat.extends("plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"),

    plugins: {
        "@typescript-eslint": typescriptEslintEslintPlugin,
        tsdoc,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
        },

        ecmaVersion: 5,
        sourceType: "module",

        parserOptions: {
            project: "tsconfig.test.json",
        },
    },

    rules: {
        "@typescript-eslint/no-explicit-any": "off",
    },
}]);