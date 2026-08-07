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

function poseVideoFixture(): string {
  return path.resolve("output/playwright/fixtures/pose-20s.mp4");
}

async function installWakeLockMock(page: Page): Promise<void> {
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
}

async function expectLocalPoseEngine(page: Page, browserName: string) {
  const engine = page.getByText(/(?:Pose Landmarker|BlazePose) Full.*local/i);
  await expect(engine).toBeVisible({ timeout: 30_000 });
  if (browserName === "webkit") {
    await expect(engine).toContainText(/BlazePose Full.*CPU.*local/i);
  }
}

test.describe("privacy-first posture coach smoke", () => {
  test("renders all modes and explicit positioning guidance", async ({ page, browserName }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Third Code Posture/);
    await expect(
      page.getByRole("heading", { name: /Posture practice, with signal/ }),
    ).toBeVisible();
    await expect(page.getByText("Device readiness", { exact: true })).toBeVisible();
    const cameraLens = page.getByLabel("Camera lens");
    await expect(cameraLens.locator("option")).toHaveCount(2);
    await expect(cameraLens).toHaveValue("user");
    await expect(page.getByRole("checkbox", { name: /Guided camera setup/ })).toBeChecked();
    await expect(page.getByText(/five-second visual and local-tone countdown/i)).toBeVisible();
    await page.getByText("Device readiness", { exact: true }).click();
    await expect(
      page.getByText(
        browserName === "webkit"
          ? "Local WASM compatibility path available"
          : "Dedicated worker, ImageBitmap, and WebAssembly available",
      ),
    ).toBeVisible();
    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    await expect(manifest.json()).resolves.toMatchObject({
      name: "Third Code Posture",
      display: "standalone",
    });
    const practiceModes = page.getByRole("listbox", { name: "Practice mode" });
    await expect(practiceModes.getByRole("option")).toHaveCount(7);
    await expect(
      page.getByText(/Standing posture \/ Local pose engine ready on demand/),
    ).toBeVisible();
    await practiceModes.getByRole("option", { name: "Plank" }).click();
    await expect(page.getByRole("heading", { name: "Posture studio" })).toBeVisible();
    await expect(page.getByText(/Plank \/ Local pose engine ready on demand/)).toBeVisible();
    await expect(page.getByText(/Side profile: place the camera/)).toBeVisible();
  });

  test("provides searchable evidence guidance without starting a camera", async ({
    page,
  }, testInfo) => {
    const externalRequests: string[] = [];
    const localOrigin = new URL(testInfo.project.use.baseURL ?? "http://127.0.0.1:3010").origin;
    page.on("request", (request) => {
      const url = request.url();
      if (new URL(url).origin !== localOrigin) externalRequests.push(url);
    });

    await page.goto("/");
    await page.getByRole("link", { name: /Learn without camera/ }).click();
    await expect(page).toHaveURL(/#posture-guide$/);
    await expect(page.locator("#posture-guide")).toBeInViewport({ ratio: 0.1 });
    await expect(
      page.getByRole("heading", { name: /Know what the camera can—and cannot—tell you/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Educational heuristic" })).toBeVisible();
    await expect(page.getByText(/tracking confidence means landmarks are visible/i)).toBeVisible();
    const measurementRegister = page.locator(".measurement-register");
    const measurementRegisterLabel = measurementRegister.getByText(
      "29 auditable measurement rules",
      { exact: true },
    );
    await expect(measurementRegisterLabel).toBeVisible();
    await measurementRegisterLabel.click();
    await expect(measurementRegister).toHaveAttribute("open", "");
    await expect(
      measurementRegister.getByRole("heading", {
        name: /Every measurable gate, correction, and rep decision has a named metric, view, threshold, rationale, and history/i,
      }),
    ).toBeVisible();
    await expect(measurementRegister.locator(".measurement-rule-card")).toHaveCount(29);
    await expect(
      measurementRegister.getByText("Squat selected range", { exact: true }),
    ).toBeVisible();
    await expect(
      measurementRegister.getByText(/Calibration − 62°, clamped to 88–125°/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Stop if pain starts or worsens." }),
    ).toBeVisible();
    await expect(page.getByText(/Camera cannot assess symptoms/i)).toBeVisible();
    await expect(page.getByText(/Seek urgent medical advice when back pain/i)).toBeVisible();
    if (process.env.POSTURE_GUIDE_SCREENSHOT === "1") {
      await page.screenshot({
        path: `output/playwright/posture-guide-overview-${testInfo.project.name}.png`,
        fullPage: false,
      });
    }

    const search = page.getByRole("searchbox", { name: "Search posture guidance" });
    await search.fill("valgus programs");
    await expect(page.getByText("1 topic found")).toBeVisible();
    const kneeTopic = page.getByText("Dynamic knee tracking", { exact: true });
    await kneeTopic.click();
    await expect(page.getByRole("heading", { name: "What you may notice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What evidence supports" })).toBeVisible();
    await expect(page.getByText("Camera limit", { exact: true })).toBeVisible();
    const source = page
      .locator(".knowledge-card[open]")
      .getByRole("link", { name: /dynamic knee valgus/i });
    await expect(source).toHaveAttribute("href", /^https:\/\//);
    await expect(source).toHaveAttribute("target", "_blank");

    await search.fill("");
    await page.getByRole("button", { name: "Desk setup", exact: true }).click();
    await expect(page.getByText("5 topics found")).toBeVisible();
    await expect(
      page.getByText("Desk setup should support comfort and position changes", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Stop if pain starts or worsens." }),
    ).toBeVisible();
    if (process.env.POSTURE_GUIDE_SCREENSHOT === "1") {
      await page.screenshot({
        path: `output/playwright/posture-guide-${testInfo.project.name}.png`,
        fullPage: false,
      });
    }
    expect(externalRequests).toEqual([]);
  });

  test("shows safe fallbacks for camera denial and invalid uploads", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("Camera permission denied", "NotAllowedError");
          },
        },
      });
    });
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

  test("runs a local upload through calibration, overlay, and summary", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "Playwright WebKit on Windows advertises codecs but cannot decode local video blobs.",
    );
    test.setTimeout(45_000);
    await installWakeLockMock(page);
    await page.addInitScript(() => {
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = async function () {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        return originalPlay.call(this);
      };
    });
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
    await page.locator('input[type="file"]').setInputFiles(poseVideoFixture());
    await expect(page.getByRole("button", { name: "Preparing video…" })).toBeDisabled();
    await expectLocalPoseEngine(page, browserName);
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
    await page.getByRole("button", { name: "Calibrate" }).click();
    await expect(page.getByText("Calibration ready")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Clear", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Session summary")).toBeVisible({ timeout: 30_000 });
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
    expect(externalRequests).toEqual([]);
    expect(faults.pageErrors).toEqual([]);
    expect(faults.consoleErrors).toEqual([]);
  });

  test("blocks calibration when observed and selected views disagree", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "Playwright WebKit on Windows advertises codecs but cannot decode local video blobs.",
    );
    await page.goto("/");
    await page
      .getByRole("listbox", { name: "Practice mode" })
      .getByRole("option", { name: "Plank" })
      .click();
    await expect(page.getByLabel("Camera view")).toHaveValue("side");
    await page.locator('input[type="file"]').setInputFiles(poseVideoFixture());
    await expectLocalPoseEngine(page, browserName);
    await page.getByRole("button", { name: "Calibrate" }).click();
    await expect(page.locator(".error-note")).toContainText(
      /observed pose looks (?:front|three-quarter), not side/i,
      { timeout: 15_000 },
    );
  });

  test("runs a local image through single-frame pose inference and overlay", async ({
    page,
    browserName,
  }) => {
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
    await expectLocalPoseEngine(page, browserName);
    await expect(page.getByRole("heading", { name: "Pose found in this image" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/image · pose found locally/i)).toBeVisible();
    await expect(
      page.locator(".feedback-heuristic-note").getByText(/Operational capture gate/),
    ).toBeVisible();
    await page.locator(".feedback-evidence > summary").click();
    await page.locator(".feedback-card .feedback-measurement-rules > summary").click();
    await expect(
      page.locator(".feedback-card").getByText("Still-image pose confidence", { exact: true }),
    ).toBeVisible();
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

  test("keeps core keyboard and form semantics accessible", async ({ page, browserName }) => {
    await page.goto("/");
    const semantics = await page.evaluate(() => {
      const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
      const controls = [
        ...document.querySelectorAll<HTMLElement>("button, input, select, textarea"),
      ];
      const unlabeledControls = controls.filter((control) => {
        if (control.getAttribute("aria-label") || control.getAttribute("aria-labelledby")) {
          return false;
        }
        if (control.closest("label")) return false;
        if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) {
          return false;
        }
        return !control.textContent?.trim();
      });
      return {
        htmlLang: document.documentElement.lang,
        h1Count: document.querySelectorAll("h1").length,
        mainCount: document.querySelectorAll("main").length,
        duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
        unlabeledControlCount: unlabeledControls.length,
      };
    });

    expect(semantics).toEqual({
      htmlLang: "en",
      h1Count: 1,
      mainCount: 1,
      duplicateIds: [],
      unlabeledControlCount: 0,
    });
    const skipLink = page.getByRole("link", { name: "Skip to posture studio" });
    if (browserName === "webkit") {
      // Safari includes links in Tab traversal only when Full Keyboard Access is enabled.
      await skipLink.focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#workspace-title$/);
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
      const selects = [...document.querySelectorAll<HTMLElement>(".select-control")];
      const video = document.querySelector<HTMLVideoElement>(".preview-video");
      const image = document.querySelector<HTMLImageElement>(".preview-image");
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        previewWidth: preview?.getBoundingClientRect().width ?? 0,
        previewHeight: preview?.getBoundingClientRect().height ?? 0,
        modeButtonHeight: modeButton?.getBoundingClientRect().height ?? 0,
        selectHeights: selects.map((select) => select.getBoundingClientRect().height),
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
    expect(layout.selectHeights.every((height) => height >= 44)).toBe(true);
    expect(layout.sourceColumns.trim().split(/\s+/)).toHaveLength(1);
    expect(layout.videoObjectFit).toBe("contain");
    expect(layout.imageObjectFit).toBe("contain");
  });

  test("calibrates front-view upload modes and rejects unsupported side-only views", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "Playwright WebKit on Windows advertises codecs but cannot decode local video blobs.",
    );
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
        await page.getByLabel("Camera view").selectOption("side");
        await expect(page.getByText("Choose a supported view before calibrating.")).toBeHidden();
        continue;
      }
      await page.getByLabel("Camera view").selectOption("front");
      await page.locator('input[type="file"]').setInputFiles(poseVideoFixture());
      await expectLocalPoseEngine(page, browserName);
      await page.getByRole("button", { name: "Calibrate" }).click();
      await expect(page.getByText("Calibration ready")).toBeVisible({ timeout: 15_000 });
    }
  });
});
