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

test("analyzes a fake webcam stream locally", async ({ page, browserName }, testInfo) => {
  await page.addInitScript(() => {
    class TestWakeLockSentinel extends EventTarget {
      released = false;

      async release() {
        if (this.released) return;
        this.released = true;
        this.dispatchEvent(new Event("release"));
      }
    }
    const sentinels: TestWakeLockSentinel[] = [];
    const stoppedTracks: MediaStreamTrack[] = [];
    Object.defineProperty(window, "__testWakeLocks", { value: sentinels });
    Object.defineProperty(window, "__stoppedCameraTracks", { value: stoppedTracks });
    const originalStop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function stop() {
      stoppedTracks.push(this);
      originalStop.call(this);
    };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          const sentinel = new TestWakeLockSentinel();
          sentinels.push(sentinel);
          return sentinel;
        },
      },
    });
  });
  const faults = captureBrowserFaults(page);
  await page.goto("/");
  const cameraLens = page.getByLabel("Camera lens");
  await expect(cameraLens).toHaveValue("user");
  await page.getByRole("button", { name: "Use webcam" }).click();
  await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Guided setup", { exact: true })).toBeVisible();
  await expect(page.locator(".guided-setup-countdown")).toHaveAttribute(
    "data-baseline-samples",
    "0",
  );
  await page.waitForTimeout(500);
  await expect(page.locator(".guided-setup-countdown")).toHaveAttribute(
    "data-baseline-samples",
    "0",
  );
  await expect(page.getByText(/Calibrating \d+\/12/)).toHaveCount(0);
  await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\d+ms live.*Detail 720px/i)).toBeVisible({ timeout: 15_000 });
  await page.locator(".device-readiness summary").click();
  await expect(page.getByText(/Screen wake lock active/i)).toBeVisible();
  await page.evaluate(async () => {
    const sentinels = (
      window as typeof window & {
        __testWakeLocks?: Array<{ release(): Promise<void> }>;
      }
    ).__testWakeLocks;
    await sentinels?.[0]?.release();
  });
  await expect(page.getByText(/System released the wake lock/i)).toBeVisible();
  if (browserName === "chromium") {
    await page.locator("video").evaluate((video) => {
      (window as typeof window & { __previousCameraStream?: MediaStream }).__previousCameraStream =
        (video as HTMLVideoElement).srcObject as MediaStream;
    });
    await cameraLens.selectOption("environment");
    await expect(cameraLens).toHaveValue("environment");
    await expect(page.getByRole("checkbox", { name: /Mirror preview/ })).not.toBeChecked();
    await expect
      .poll(() =>
        page.locator("video").evaluate((video) => {
          const testWindow = window as typeof window & {
            __previousCameraStream?: MediaStream;
            __stoppedCameraTracks?: MediaStreamTrack[];
          };
          const previous = testWindow.__previousCameraStream;
          const current = (video as HTMLVideoElement).srcObject as MediaStream | null;
          const previousTracks = previous?.getTracks() ?? [];
          return Boolean(
            previous &&
            current &&
            current !== previous &&
            previousTracks.length > 0 &&
            previousTracks.every(
              (track) =>
                track.readyState === "ended" || testWindow.__stoppedCameraTracks?.includes(track),
            ),
          );
        }),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const sentinels = (
            window as typeof window & { __testWakeLocks?: Array<{ released: boolean }> }
          ).__testWakeLocks;
          return Boolean(sentinels && sentinels.length >= 2 && sentinels[0]?.released);
        }),
      )
      .toBe(true);
    await expect(page.getByText(/Rear camera.*source.*effective/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Screen wake lock active/i)).toBeVisible();
    if (testInfo.project.name === "chromium") {
      // The deterministic camera fixture is a one-leg balance pose. Use desk
      // mode here so this lifecycle test does not bypass standing's full-feet
      // evidence gate merely to prove calibration wiring.
      await page
        .getByRole("listbox", { name: "Practice mode" })
        .getByRole("option", { name: "Desk posture" })
        .click();
      await page.getByRole("button", { name: /Calibrate now/ }).click();
      await expect(page.getByText("Calibration ready")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Clear", { exact: true })).toBeVisible({ timeout: 15_000 });
    }
  }
  await page.getByRole("button", { name: "Stop session" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sentinels = (
          window as typeof window & { __testWakeLocks?: Array<{ released: boolean }> }
        ).__testWakeLocks;
        return Boolean(sentinels?.length && sentinels.every((sentinel) => sentinel.released));
      }),
    )
    .toBe(true);
  expect(faults.pageErrors).toEqual([]);
  expect(faults.consoleErrors).toEqual([]);
});

test("keeps bounded canvas inference and adapts after sustained latency", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Dedicated desktop Chrome fallback probe.");
  await page.addInitScript(() => {
    const originalCreateImageBitmap = window.createImageBitmap.bind(window);
    Object.defineProperty(window, "__resizeOptionFailures", { value: 0, writable: true });
    Object.defineProperty(window, "__slowCanvasBitmaps", { value: false, writable: true });
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async (source: ImageBitmapSource, options?: ImageBitmapOptions) => {
        const testWindow = window as typeof window & {
          __resizeOptionFailures: number;
          __slowCanvasBitmaps: boolean;
        };
        if (options?.resizeWidth || options?.resizeHeight) {
          testWindow.__resizeOptionFailures += 1;
          throw new TypeError("Resize options unavailable in this probe.");
        }
        if (source instanceof HTMLCanvasElement && testWindow.__slowCanvasBitmaps) {
          await new Promise((resolve) => window.setTimeout(resolve, 420));
        }
        return originalCreateImageBitmap(source);
      },
    });
  });
  const faults = captureBrowserFaults(page);
  await page.goto("/");
  await page.getByLabel("Camera view").selectOption("front");
  await page.evaluate(() => {
    (
      window as typeof window & {
        __slowCanvasBitmaps: boolean;
      }
    ).__slowCanvasBitmaps = true;
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("output/playwright/fixtures/pose-20s.mp4"));
  await expect(page.getByText(/Pose Landmarker Full.*local/i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/\d+ms live.*Balanced 576px/i)).toBeVisible({ timeout: 30_000 });
  await page.locator(".device-readiness summary").click();
  await expect(page.getByText(/Balanced profile.*current 576×576/i)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __resizeOptionFailures?: number }).__resizeOptionFailures ??
          0,
      ),
    )
    .toBeGreaterThan(0);
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
  await page.getByRole("button", { name: "Stop session" }).click();
  expect(faults.pageErrors).toEqual([]);
  expect(faults.consoleErrors).toEqual([]);
});

test("ends camera session and releases wake lock when page becomes hidden", async ({ page }) => {
  await page.addInitScript(() => {
    class TestWakeLockSentinel extends EventTarget {
      released = false;

      async release() {
        if (this.released) return;
        this.released = true;
        this.dispatchEvent(new Event("release"));
      }
    }
    const sentinels: TestWakeLockSentinel[] = [];
    Object.defineProperty(window, "__testWakeLocks", { value: sentinels });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          const sentinel = new TestWakeLockSentinel();
          sentinels.push(sentinel);
          return sentinel;
        },
      },
    });
  });
  const faults = captureBrowserFaults(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Use webcam" }).click();
  await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sentinels = (
          window as typeof window & { __testWakeLocks?: Array<{ released: boolean }> }
        ).__testWakeLocks;
        return Boolean(sentinels?.length && !sentinels[0]?.released);
      }),
    )
    .toBe(true);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect
    .poll(() =>
      page.locator("video").evaluate((video) => (video as HTMLVideoElement).srcObject === null),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sentinels = (
          window as typeof window & { __testWakeLocks?: Array<{ released: boolean }> }
        ).__testWakeLocks;
        return Boolean(sentinels?.length && sentinels.every((sentinel) => sentinel.released));
      }),
    )
    .toBe(true);
  await expect(page.locator(".guided-setup-countdown")).toHaveCount(0);
  expect(faults.pageErrors).toEqual([]);
  expect(faults.consoleErrors).toEqual([]);
});

test.describe("mobile portrait camera", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test("rotates a landscape camera source before preview and inference", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Portrait fake-video compositor requires Chrome.");
    const faults = captureBrowserFaults(page);
    await page.goto("/");
    await page.getByLabel("Camera lens").selectOption("environment");
    await page.getByRole("button", { name: "Use webcam" }).click();
    await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Guided setup", { exact: true })).toBeVisible();
    await expect(page.locator(".guided-setup-countdown")).toHaveAttribute(
      "data-baseline-samples",
      "0",
    );
    await page.waitForTimeout(500);
    await expect(page.locator(".guided-setup-countdown")).toHaveAttribute(
      "data-baseline-samples",
      "0",
    );
    await expect(page.getByText(/Calibrating \d+\/12/)).toHaveCount(0);
    await expect(page.locator(".portrait-preview-canvas")).toHaveClass(/is-visible/, {
      timeout: 15_000,
    });
    await expect(page.getByText("Guided setup", { exact: true })).toBeHidden({ timeout: 8_000 });
    await expect(
      page.getByText(/Calibrating \d+\/12|Checking steadiness|Calibration ready/),
    ).toBeVisible({ timeout: 5_000 });
    await page.locator(".device-readiness summary").click();
    await expect(
      page.getByText(/Rear camera.*source, .*effective.*rotated locally/i),
    ).toBeVisible();

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
