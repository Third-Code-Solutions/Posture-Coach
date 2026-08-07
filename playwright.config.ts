import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3010";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Pose models are intentionally large. Parallel model instances create artificial
  // GPU/CPU contention that no single-user browser session experiences.
  workers: 1,
  reporter: "list",
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec serve out --single --listen ${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: origin,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "firefox",
      testIgnore: /camera\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: /camera\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      testIgnore: /camera\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      testIgnore: /camera\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },
  ],
});
