import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

function captureBrowserFaults(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("INFO:")) {
      consoleErrors.push(message.text());
    }
  });
  return { pageErrors, consoleErrors };
}

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${path.resolve(
        "output/playwright/fixtures/pose-camera.y4m",
      )}`,
    ],
  },
});

test("analyzes a fake webcam stream locally", async ({ page }) => {
  const faults = captureBrowserFaults(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Use webcam" }).click();
  await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calibrate" }).click();
  await expect(page.getByText("Calibration ready")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Clear", { exact: true })).toBeVisible({ timeout: 15_000 });
  expect(faults.pageErrors).toEqual([]);
  expect(faults.consoleErrors).toEqual([]);
});
