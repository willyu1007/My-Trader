import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/main/index.ts",
    preload: "src/preload/index.ts"
  },
  format: ["cjs"],
  target: "es2022",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  dts: false,
  external: ["electron"],
  noExternal: ["@mytrader/shared"],
  onSuccess: "node scripts/copy-sql-wasm.mjs"
});
