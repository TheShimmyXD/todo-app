// ESLint configuration (flat config) for the backend: the recommended TypeScript rules,
// applied to the source, the tests and the config files. Run it with `npm run lint`.
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "node_modules/"] },
  tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore marks a parameter that must exist but is not used, such as
      // the `next` argument Express requires in an error handler.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
