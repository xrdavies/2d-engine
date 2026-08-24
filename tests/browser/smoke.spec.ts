import { expect, test } from "@playwright/test";

test("triangle example loads", async ({ page }) => {
  await page.goto("/examples/triangle/");
  await expect(page.locator("#status")).toBeVisible();
  await expect(page.locator("#canvas")).toBeVisible();
});

test("device example reports a WebGPU result", async ({ page }) => {
  await page.goto("/examples/device/");
  await expect(page.locator("#status")).toHaveText(
    /WebGPU (device ready|unavailable)/,
  );
});

test("sprite example renders or reports unavailable WebGPU", async ({
  page,
}) => {
  await page.goto("/examples/sprites/");
  await expect(page.locator("#status")).toHaveText(
    /Rendered Image2D and Sprite|WebGPU unavailable/,
  );
  const rendered = await page.evaluate(
    () =>
      (window as unknown as { __engineRendered?: boolean }).__engineRendered ===
      true,
  );
  if (rendered) {
    await expect(page.locator("#stats")).toHaveText(/batches/);
  }
});
