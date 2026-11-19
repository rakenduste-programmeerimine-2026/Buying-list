import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const backend = fileURLToPath(new URL("./backend/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // "server-only" viskab vea väljaspool Next.js serverit; testides asendame tühja mooduliga.
      { find: "server-only", replacement: `${backend}tests/helpers/empty.ts` },
      // Testid kontrollivad ainult backendi koodi: @/lib, @/app ja @/types → backend/.
      // (Next.js ja TypeScript lahendavad @/ tsconfig.json "paths" järgi: ./ → ./frontend → ./backend.)
      { find: /^@\/(lib|app|types)\//, replacement: `${backend}$1/` },
    ],
  },
  test: {
    environment: "node",
    include: ["backend/tests/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      // Ainult backendi kood; frontend/ jääb välja.
      include: ["backend/lib/**", "backend/app/**"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
