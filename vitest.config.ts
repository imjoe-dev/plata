import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(srcDir),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
