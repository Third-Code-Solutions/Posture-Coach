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

test.describe("privacy-first posture coach smoke", () => {
  test("renders all modes and explicit positioning guidance", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Third Code Posture/);
    await expect(
      page.getByRole("heading", { name: /Posture practice, with signal/ }),
    ).toBeVisible();
    const practiceModes = page.getByRole("listbox", { name: "Practice mode" });
    await expect(practiceModes.getByRole("option")).toHaveCount(6);
    await practiceModes.getByRole("option", { name: "Plank" }).click();
    await expect(page.getByRole("heading", { name: "Posture studio" })).toBeVisible();
    await expect(page.getByText(/Plank \/ Local worker ready on demand/)).toBeVisible();
    await expect(page.getByText(/Side profile: place the camera/)).toBeVisible();
  });

  test("shows safe fallbacks for camera denial and invalid uploads", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Use webcam" }).click();
    await expect(page.locator(".error-note")).toContainText(/camera|Camera access/i);

    await page.locator('input[type="file"]').setInputFiles({
      name: "not-a-video.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("local test fixture"),
    });
    await expect(page.locator(".error-note")).toContainText(/browser-playable video or image/i);
    await expect(page.getByText(/not uploaded/i)).toBeVisible();
  });

  test("shows a no-device fallback when the browser has no camera", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("No camera", "NotFoundError");
          },
        },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Use webcam" }).click();
    await expect(page.locator(".error-note")).toContainText(/No usable camera/i);
    await expect(page.getByRole("button", { name: "Choose video or image" })).toBeVisible();
  });

  test("surfaces unsupported exercise views before calibration", async ({ page }) => {
    await page.goto("/");
    const modes = page.getByRole("listbox", { name: "Practice mode" });
    await modes.getByRole("option", { name: "Plank" }).click();
    await page.getByLabel("Camera view").selectOption("front");
    await expect(page.getByText("Set your view").first()).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/supported view/i);
  });

  test("runs a local upload through calibration, overlay, and summary", async ({ page }) => {
    test.setTimeout(45_000);
    const faults = captureBrowserFaults(page);
    const externalRequests: string[] = [];
    let localOrigin = "";
    page.on("request", (request) => {
      const url = request.url();
      if (localOrigin && !url.startsWith(localOrigin) && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });
    await page.goto("/");
    localOrigin = new URL(page.url()).origin;
    await page.getByLabel("Camera view").selectOption("front");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.resolve("output/playwright/fixtures/pose-20s.mp4"));
    await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Calibrate" }).click();
    await expect(page.getByText("Calibration ready")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Clear", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Session summary")).toBeVisible({ timeout: 30_000 });
    expect(externalRequests).toEqual([]);
    expect(faults.pageErrors).toEqual([]);
    expect(faults.consoleErrors).toEqual([]);
  });

  test("blocks calibration when observed and selected views disagree", async ({ page }) => {
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.resolve("output/playwright/fixtures/pose-20s.mp4"));
    await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Calibrate" }).click();
    await expect(page.locator(".error-note")).toContainText(/observed pose looks front/i, {
      timeout: 15_000,
    });
  });

  test("runs a local image through single-frame pose inference and overlay", async ({ page }) => {
    test.setTimeout(30_000);
    const faults = captureBrowserFaults(page);
    const externalRequests: string[] = [];
    let localOrigin = "";
    page.on("request", (request) => {
      const url = request.url();
      if (localOrigin && !url.startsWith(localOrigin) && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });
    await page.goto("/");
    localOrigin = new URL(page.url()).origin;
    await expect(page.locator('input[type="file"]')).toHaveAttribute("accept", "video/*,image/*");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.resolve("output/playwright/fixtures/pose_model.png"));
    await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Pose found in this image" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/image · pose found locally/i)).toBeVisible();
    await expect(page.locator("img.preview-image")).toBeVisible();
    const overlayPixels = await page.locator("canvas.preview-canvas").evaluate((canvas) => {
      const canvasElement = canvas as HTMLCanvasElement;
      const context = canvasElement.getContext("2d");
      if (!context) return 0;
      const pixels = context.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
      let count = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) count += 1;
      }
      return count;
    });
    expect(overlayPixels).toBeGreaterThan(0);
    expect(externalRequests).toEqual([]);
    expect(faults.pageErrors).toEqual([]);
    expect(faults.consoleErrors).toEqual([]);
  });

  test("keeps the shell within common viewport widths", async ({ page }) => {
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const layout = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(layout.documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        layout.viewportWidth,
      );
    }
  });

  test("keeps the full-frame preview and touch controls usable on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator(".mobile-capture-note")).toBeVisible();
    const layout = await page.evaluate(() => {
      const preview = document.querySelector<HTMLElement>(".preview-wrap");
      const modeButton = document.querySelector<HTMLElement>(".mode-button");
      const sourceActions = document.querySelector<HTMLElement>(".source-actions");
      const video = document.querySelector<HTMLVideoElement>(".preview-video");
      const image = document.querySelector<HTMLImageElement>(".preview-image");
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        previewWidth: preview?.getBoundingClientRect().width ?? 0,
        previewHeight: preview?.getBoundingClientRect().height ?? 0,
        modeButtonHeight: modeButton?.getBoundingClientRect().height ?? 0,
        sourceColumns: sourceActions ? getComputedStyle(sourceActions).gridTemplateColumns : "",
        videoObjectFit: video ? getComputedStyle(video).objectFit : "",
        imageObjectFit: image ? getComputedStyle(image).objectFit : "",
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.previewWidth).toBeGreaterThan(300);
    expect(layout.previewWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.previewHeight).toBeGreaterThan(450);
    expect(layout.previewHeight).toBeGreaterThan(layout.previewWidth);
    expect(layout.modeButtonHeight).toBeGreaterThanOrEqual(44);
    expect(layout.sourceColumns.trim().split(/\s+/)).toHaveLength(1);
    expect(layout.videoObjectFit).toBe("contain");
    expect(layout.imageObjectFit).toBe("contain");
  });

  test("calibrates every exercise mode through the local upload path", async ({ page }) => {
    test.setTimeout(120_000);
    const modes = ["Bodyweight squat", "Plank", "Push-up", "Lunge", "Bicep curl"];
    for (const mode of modes) {
      await page.goto("/");
      await page
        .getByRole("listbox", { name: "Practice mode" })
        .getByRole("option", { name: mode })
        .click();
      if (mode === "Plank" || mode === "Push-up") {
        await page.getByLabel("Camera view").selectOption("front");
        await expect(page.getByText("Choose a supported view before calibrating.")).toBeVisible();
        continue;
      }
      await page.getByLabel("Camera view").selectOption("front");
      await page
        .locator('input[type="file"]')
        .setInputFiles(path.resolve("output/playwright/fixtures/pose-20s.mp4"));
      await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Calibrate" }).click();
      await expect(page.getByText("Calibration ready")).toBeVisible({ timeout: 15_000 });
    }
  });
});
