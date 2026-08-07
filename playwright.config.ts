import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3010";
const origin = `http://127.0.0.1:${port}`;
const chromeFakeCameraArgs = [
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${path
    .resolve("output/playwright/fixtures/pose-camera.y4m")
    .replaceAll("\\", "/")}`,
];

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
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        permissions: ["camera"],
        launchOptions: { args: chromeFakeCameraArgs },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          firefoxUserPrefs: {
            "media.navigator.permission.disabled": true,
            "media.navigator.streams.fake": true,
            "media.getusermedia.camera.fake.force": true,
          },
        },
      },
    },
    {
      name: "webkit",
      testIgnore: /camera\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        channel: "chrome",
        permissions: ["camera"],
        launchOptions: { args: chromeFakeCameraArgs },
      },
    },
    {
      name: "mobile-webkit",
      testIgnore: /camera\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },
  ],
});
