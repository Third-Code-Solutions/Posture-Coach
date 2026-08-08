import { expect, test } from "@playwright/test";

test("mobile calibration stays active and explains why standing samples are blocked", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("webkit"),
    "Playwright WebKit camera emulation is intentionally unavailable on Windows.",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");

  await page.getByRole("button", { name: "Use webcam" }).click();
  await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Calibrate now/ }).click();

  const calibrationCoach = page.getByRole("status", { name: "Calibration coach" });
  await expect(calibrationCoach).toBeVisible({ timeout: 15_000 });
  await expect(calibrationCoach).toContainText(
    /full body|both feet|camera view clear|selected view|camera find you/i,
    { timeout: 15_000 },
  );
  await expect(page.getByRole("progressbar", { name: "Calibration progress" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  const cancelButton = page.getByRole("button", { name: "Cancel calibration" });
  await expect(cancelButton).toBeVisible();
  const layout = await page.evaluate(() => {
    const coach = document.querySelector<HTMLElement>(".calibration-coach");
    const controls = document.querySelector<HTMLElement>(".controls-panel");
    const visibleChildren = [...(controls?.children ?? [])].filter(
      (element) => getComputedStyle(element).display !== "none",
    );
    const button = coach?.querySelector<HTMLButtonElement>("button");
    const coachTop = coach?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      coachWidth: coach?.getBoundingClientRect().width ?? 0,
      buttonHeight: button?.getBoundingClientRect().height ?? 0,
      coachIsFirstOnMobile:
        Boolean(coach) &&
        visibleChildren.every(
          (element) => element === coach || element.getBoundingClientRect().top >= coachTop,
        ),
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.coachWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(layout.coachIsFirstOnMobile).toBe(true);
});

test("a valid stable pose completes calibration and exposes a clear restart action", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium", "mobile-chromium"].includes(testInfo.project.name),
    "Deterministic pose fixture is Chromium-only.",
  );

  await page.goto("/");
  await page
    .getByRole("listbox", { name: "Practice mode" })
    .getByRole("option", { name: "Desk posture" })
    .click();
  await page.getByRole("button", { name: "Use webcam" }).click();
  await expect(page.getByText(/camera.*processing on device/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Calibrate now/ }).click();

  await expect(page.getByText("Calibration ready", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Recalibrate" })).toBeVisible();
});
