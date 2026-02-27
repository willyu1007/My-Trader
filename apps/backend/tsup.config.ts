import { defineConfig } from "tsup";

const isWatchMode = process.argv.includes("--watch");

export default defineConfig({
  entry: {
    main: "src/main/index.ts",
    preload: "src/preload/index.ts",
    "verify-position-engine": "src/main/verifyPositionEngine.ts",
    "verify-completeness-v2": "src/main/verifyCompletenessV2.ts",
    "verify-insights-e2e": "src/main/verifyInsightsE2E.ts"
  },
  format: ["cjs"],
  target: "es2022",
  outDir: "dist",
  sourcemap: true,
  // Keep dist artifacts during watch rebuilds to avoid Electron restart races.
  clean: !isWatchMode,
  dts: false,
  external: ["electron"],
  noExternal: ["@mytrader/shared"],
  onSuccess: "node scripts/copy-sql-wasm.mjs"
}));
