import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDirectory });

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", "dist/**", "next-env.d.ts"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
