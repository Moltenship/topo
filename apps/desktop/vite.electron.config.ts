import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const external = [
  "electron",
  "better-sqlite3",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    target: "node22",
    lib: {
      entry: {
        main: "electron/main.ts",
        preload: "electron/preload.ts",
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external,
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
