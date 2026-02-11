import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      exclude: ['archiver', 'archiver-utils', 'zip-stream', 'compress-commons', 'crc-32', 'crc32-stream', 'readable-stream', 'lazystream']
    })],
    resolve: {
      alias: {
        "@/lib": resolve("src/main/lib"),
        "@/shared": resolve("src/shared"),
        "@shared": resolve("src/shared"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
        "@/components": resolve("src/renderer/src/components"),
        "@/utils": resolve("src/renderer/src/utils"),
        "@/hooks": resolve("src/renderer/src/hooks"),
        "@/pages": resolve("src/renderer/src/pages"),
        "@/layouts": resolve("src/renderer/src/layouts"),
        "@/assets": resolve("src/renderer/src/assets"),
      },
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
});
