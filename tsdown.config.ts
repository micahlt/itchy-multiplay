import { defineConfig } from "tsdown";

export default defineConfig([
  // 1. Standard Library Build (NPM / Itchy Hooks)
  {
    entry: "src/index.ts",
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    platform: "neutral",
  },
  {
    entry: {
      mobile: "src/rn-entry.ts",
    },
    format: ["iife"],
    globalName: "MultiPlay",
    minify: true,
    platform: "browser",
    outDir: "dist/reactnative",
  },
  // {
  //   entry: {
  //     extension: "src/extension-entry.ts",
  //   },
  //   format: ["esm"],
  //   minify: true,
  //   platform: "browser",
  //   outDir: "dist/extension",
  // },
]);
