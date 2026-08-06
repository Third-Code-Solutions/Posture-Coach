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

test.describe("mobile portrait camera", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test("rotates a landscape camera source before preview and inference", async ({ page }) => {
    const faults = captureBrowserFaults(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Use webcam" }).click();
    await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".portrait-preview-canvas")).toHaveClass(/is-visible/, {
      timeout: 15_000,
    });

    const geometry = await page.evaluate(() => {
      const video = document.querySelector("video");
      const canvas = document.querySelector(".portrait-preview-canvas") as HTMLCanvasElement | null;
      const preview = document.querySelector(".preview-wrap");
      if (!video || !canvas || !preview) throw new Error("Camera preview DOM is incomplete.");
      const previewRect = preview.getBoundingClientRect();
      return {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        canvasVisible: canvas.classList.contains("is-visible"),
        rawVideoOpacity: getComputedStyle(video).opacity,
        previewWidth: previewRect.width,
        previewHeight: previewRect.height,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    expect(geometry.videoWidth).toBeGreaterThan(geometry.videoHeight);
    expect(geometry.canvasWidth).toBe(geometry.videoHeight);
    expect(geometry.canvasHeight).toBe(geometry.videoWidth);
    expect(geometry.canvasVisible).toBe(true);
    expect(geometry.rawVideoOpacity).toBe("0");
    expect(geometry.previewHeight).toBeGreaterThan(geometry.previewWidth);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(faults.pageErrors).toEqual([]);
    expect(faults.consoleErrors).toEqual([]);
  });
});
