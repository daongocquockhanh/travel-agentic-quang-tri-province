import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same JSX transform as Next, so components render without importing React.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside a React Server Component build.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // .tsx tests render components; they opt into happy-dom per file.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Route tests call handlers repeatedly from one "IP"; rate-limit tests opt back in.
    env: { RATE_LIMIT: "off" },
  },
});
