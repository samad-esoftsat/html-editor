import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/app/**/page.tsx', 'src/app/**/layout.tsx', 'src/lib/api/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.name='process'][property.name='env'] > Identifier[name='SUPABASE_SERVICE_ROLE_KEY']",
        message: 'SUPABASE_SERVICE_ROLE_KEY must never be referenced in client-bundled code.',
      }],
    },
  },
];

export default eslintConfig;
