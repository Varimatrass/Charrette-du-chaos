import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Tests d'intégration (test/**\/*.e2e-spec.ts) : vraie appli, vraie base.
 * Les fichiers s'exécutent l'un après l'autre car ils partagent la base de
 * test (voir test/support).
 */
export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    setupFiles: ["test/support/env.ts"],
    globalSetup: ["test/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
