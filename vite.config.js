import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { VitePWA } from "vite-plugin-pwa";
import compression from "vite-plugin-compression2";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";

import dns from "dns";
import path from "path";

dns.setDefaultResultOrder("verbatim");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "package.json"), "utf8"),
);

/**
 * workbox-build writes absolute import paths with single quotes. Paths that
 * contain an apostrophe (e.g. "Zul's Projects") break SW generation with
 * "Missing semicolon". Re-apply a safe JSON.stringify escape after npm install.
 */
function ensureWorkboxApostrophePathFix() {
  const registryPath = path.join(
    __dirname,
    "node_modules/workbox-build/build/lib/module-registry.js",
  );
  if (!existsSync(registryPath)) return;

  const source = readFileSync(registryPath, "utf8");
  const alreadyFixed = source.includes("const modulePath = JSON.stringify");
  const hasBuggyQuote = source.includes("'${pkgRoot}/${moduleName}.mjs'");
  if (alreadyFixed || !hasBuggyQuote) return;

  const patched = source.replace(
    [
      "            const pkgJsonPath = require.resolve(`${pkg}/package.json`);",
      "            const pkgRoot = upath_1.default.dirname(pkgJsonPath);",
      "            const importStatement = (0, common_tags_1.oneLine) `import {${moduleName} as ${localName}} from",
      "        '${pkgRoot}/${moduleName}.mjs';`;",
    ].join("\n"),
    [
      "            const pkgJsonPath = require.resolve(`${pkg}/package.json`);",
      "            const pkgRoot = upath_1.default.dirname(pkgJsonPath);",
      "            // JSON.stringify so paths with apostrophes (e.g. Zul's Projects) stay valid JS.",
      "            const modulePath = JSON.stringify(`${pkgRoot}/${moduleName}.mjs`);",
      "            const importStatement = (0, common_tags_1.oneLine) `import {${moduleName} as ${localName}} from",
      "        ${modulePath};`;",
    ].join("\n"),
  );

  if (patched !== source) {
    writeFileSync(registryPath, patched, "utf8");
  }
}

ensureWorkboxApostrophePathFix();

// Single source of truth for version + deploy date used by:
// - injected build constants (__APP_VERSION__, __APP_DEPLOY_DATE__)
// - generated version.json (used by useVersionCheck hook)
const FALLBACK_VERSION = process.env.VITE_APP_VERSION ?? pkg.version ?? "0.0.0";
const FALLBACK_DEPLOY_DATE =
  process.env.VITE_APP_DEPLOY_DATE ?? new Date().toISOString();

/** Plugin: write version.json to output dir with same version/deployDate as VersionInfo (VITE_APP_*). */
function versionJsonPlugin() {
  let outDir = path.resolve(__dirname, "dist");
  return {
    name: "version-json",
    configResolved(config) {
      outDir = path.resolve(config.build.outDir);
    },
    writeBundle() {
      const version = FALLBACK_VERSION;
      const deployDate = FALLBACK_DEPLOY_DATE;
      const versionPath = path.join(outDir, "version.json");
      writeFileSync(
        versionPath,
        JSON.stringify({ version, deployDate }, null, 2),
        "utf8",
      );
    },
  };
}

export default defineConfig({
  // Ensure assets load from site root
  base: "/",

  build: {
    assetsDir: "assets",
    chunkSizeWarningLimit: 10 * 1024, // Only keep this once
    // Sourcemaps on ~18k modules stall Rollup past Vercel's 45m build limit.
    // Enable locally with: VITE_SOURCEMAP=true npm run build
    sourcemap: process.env.VITE_SOURCEMAP === "true",
    cssCodeSplit: true,
    reportCompressedSize: false, // skip gzip size reporting (saves CI time)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/")) {
            return "vendor-react";
          }
          if (id.includes("@mui") || id.includes("@emotion")) {
            return "vendor-mui";
          }
          if (id.includes("antd") || id.includes("@ant-design")) {
            return "vendor-antd";
          }
          if (id.includes("firebase")) return "vendor-firebase";
          if (id.includes("chart.js") || id.includes("recharts")) {
            return "vendor-charts";
          }
          if (
            id.includes("@react-pdf") ||
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("html2pdf")
          ) {
            return "vendor-pdf";
          }
          if (
            id.includes("lodash") ||
            id.includes("moment") ||
            id.includes("dayjs") ||
            id.includes("date-fns") ||
            id.includes("axios")
          ) {
            return "vendor-utils";
          }
        },
      },
    },
    minify: "esbuild",
    esbuild: {
      drop: ["console", "debugger"], // Remove console and debugger statements in production
    },
  },
  plugins: [
    react(),
    cssInjectedByJsPlugin(),

    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        // enabled: process.env.SW_DEV === "true",
        enabled: false,
        /* when using generateSW the PWA plugin will switch to classic */
        type: "module",
        navigateFallback: "index.html",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Activate the new service worker immediately on all tabs without
        // waiting for the user to close and reopen the browser.
        skipWaiting: true,
        clientsClaim: true,
      },
      // add this to cache all the
      // // static assets in the public folder
      // includeAssets: ["**/*"],
      includeAssets: [
        "src/assets/img/logo/*.png",
        "src/assets/img/*.png",
        "src/assets/img/*.jepg",
        "src/assets/img/*.webp",
        "favicon.ico",
      ],
      manifest: {
        theme_color: "#FFFFFF",
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait",
        scope: ".",
        start_url: ".",
        id: ".",
        short_name: "PCI",
        name: "PCI Dashboard",
        description:
          "Dashtar : React Grocery & Organic Food Store e-commerce Admin Dashboard",
        icons: [
          {
            src: "favicon.ico",
            sizes: "48x48",
            type: "image/x-icon",
          },
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
    compression(),
    versionJsonPlugin(),
  ],

  server: {
    proxy: {
      "/api/": {
        target: "http://localhost:5000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const h = req.headers.host;
            if (h) proxyReq.setHeader("X-Forwarded-Host", h);
          });
        },
      },
      "/uploads": {
        target: "http://localhost:5000", // Backend server hosting the images
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const h = req.headers.host;
            if (h) proxyReq.setHeader("X-Forwarded-Host", h);
          });
        },
      },
    },
  },

  define: {
    "process.env": process.env,
    __APP_VERSION__: JSON.stringify(FALLBACK_VERSION),
    __APP_DEPLOY_DATE__: JSON.stringify(FALLBACK_DEPLOY_DATE),
    // global: {}, //enable this when running on dev/local mode
  },

  resolve: {
    alias: {
      // eslint-disable-next-line no-undef
      "@": path.resolve(__dirname, "./src/"),
      // "@/layouts": path.resolve(__dirname, "./src/page-layouts/"),
    },
  },
  test: {
    global: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTest.js"],
  },
});
