import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const local = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "@/config": local("./tests/stubs/site-config.ts"),
      "@/content.config": local("./tests/stubs/content-config.ts"),
      "astro:i18n": local("./tests/stubs/astro-i18n.ts"),
      "@": local("./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.{ts,mjs}",
        "src/utils/postFilter.ts",
        "src/utils/getPostPaths.ts",
        "src/utils/getSortedPosts.ts",
        "scripts/lib/*.mjs",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
