import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

type ExecFileSync = typeof execFileSync;

export function resolveAppVersion(runCommand: ExecFileSync = execFileSync) {
  try {
    const version = String(
      runCommand("git", ["describe", "--tags", "--abbrev=0"], {
        encoding: "utf8"
      })
    ).trim();

    return version || "unknown";
  } catch {
    return "unknown";
  }
}

const appVersion = resolveAppVersion();

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["node_modules/**", "dist/**", "dist-electron/**"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
