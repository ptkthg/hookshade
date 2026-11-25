import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: { width: 1440, height: 1000 },
    locale: "pt-BR", timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure", screenshot: "only-on-failure" },
});
