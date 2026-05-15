import { builtinModules } from "node:module";
import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const external = [
  "electron",
  "better-sqlite3",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      target: "node22",
      rollupOptions: {
        external,
        input: {
          main: resolve(__dirname, "electron/main.ts"),
        },
        output: {
          format: "es",
          chunkFileNames: "chunks/[name]-[hash].js",
        },
      },
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
      target: "node22",
      rollupOptions: {
        external,
        input: {
          preload: resolve(__dirname, "electron/preload.ts"),
        },
        output: {
          format: "cjs",
        },
      },
    },
  },
  renderer: {
    root: "renderer",
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "renderer/src"),
      },
    },
    build: {
      outDir: "../dist/renderer",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "renderer/index.html"),
        },
      },
    },
  },
});
