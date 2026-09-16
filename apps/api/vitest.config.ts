import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Tests unitaires (src/**\/*.spec.ts). SWC remplace esbuild pour la
 * transformation TypeScript : c'est lui qui émet les métadonnées de
 * décorateurs (`emitDecoratorMetadata`) dont l'injection de dépendances de
 * Nest et class-validator ont besoin.
 */
export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/testing/**", "src/main.ts", "src/**/*.module.ts"],
    },
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
