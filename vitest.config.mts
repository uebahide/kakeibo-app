import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Dates are built with the machine's clock (parseDate, toDateString), so tests run in one fixed zone.
process.env.TZ = "Asia/Tokyo";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/lib/__tests__/setup.ts"],
  },
});
