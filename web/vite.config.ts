import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const githubActions = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.GITHUB_ACTIONS;

export default defineConfig({
  base: githubActions ? "/work-shackle-web/" : "/",
  plugins: [react()],
  server: { port: 1430 },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
