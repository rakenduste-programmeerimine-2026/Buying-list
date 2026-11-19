import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // "server-only" viskab vea väljaspool Next.js serverit; testides asendame tühja mooduliga.
      "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      // Ainult backendi kood (frontendi failid lib/api*.ts jms jäävad välja).
      include: ["lib/data/**", "lib/actions/**", "lib/http/**", "lib/supabase/**", "app/api/**", "app/auth/**"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
