import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/app/login/page.tsx",
      "src/app/admin/academic/academic-setup-client.tsx",
    ],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["src/app/admin/staff/staff-management-client.tsx"],
    rules: {
      // Initial data already provides the first paint; the revalidation effect is intentionally retained until the staff API has subscription-based updates.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
