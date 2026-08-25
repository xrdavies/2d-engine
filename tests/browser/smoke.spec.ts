import { expect, test } from "@playwright/test";

test("triangle example loads", async ({ page }) => {
  await page.goto("/examples/triangle/");
  await expect(page.locator("#status")).toBeVisible();
  await expect(page.locator("#canvas")).toBeVisible();
});

test("device example reports a WebGPU result", async ({ page }, testInfo) => {
  await page.goto("/examples/device/");
  await expect(page.locator("#status")).toHaveText(
    testInfo.project.name === "chromium-webgpu"
      ? "WebGPU device ready"
      : /WebGPU (device ready|unavailable)/,
  );
});

test("sprite example renders or reports unavailable WebGPU", async ({
  page,
}, testInfo) => {
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
  if (testInfo.project.name === "chromium-webgpu") expect(rendered).toBe(true);
});

test("text and tilemap examples load", async ({ page }, testInfo) => {
  await page.goto("/examples/text/");
  await expect(page.locator("#status")).toHaveText(/line\(s\)/);
  if (testInfo.project.name === "chromium-webgpu") {
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __textRenderedWithWebGpu?: boolean })
            .__textRenderedWithWebGpu === true,
      ),
    ).toBe(true);
  }
  await page.goto("/examples/tilemap/");
  await expect(page.locator("#status")).toHaveText(/tilemap/);
  await page.goto("/examples/benchmark/");
  await expect(page.locator("#status")).toHaveText(
    testInfo.project.name === "chromium-webgpu"
      ? "Benchmark completed"
      : /Benchmark (completed|harness ready)/,
  );
  if (testInfo.project.name === "chromium-webgpu") {
    await expect(page.locator("#result")).toContainText('"passed": true');
  }
});

test("Image2D example renders on WebGPU", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-webgpu");
  await page.goto("/examples/image/");
  await expect(page.locator("#status")).toHaveText("Image2D rendered");
});

test("canvas backing size remains stable across high-DPR resize", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-webgpu");
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto("/examples/device/");
  await expect(page.locator("#status")).toHaveText("WebGPU device ready");
  const before = await page.locator("#canvas").evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
  }));
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  const after = await page.locator("#canvas").evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
  }));
  expect(after).toEqual(before);
  await context.close();
});

test("animation and audio examples load", async ({ page }) => {
  await page.goto("/examples/animation/");
  await expect(page.locator("#status")).toHaveText("AnimationPlayer running");
  await page.goto("/examples/audio/");
  await expect(page.locator("#status")).toHaveText(
    /Audio is locked|Audio context/,
  );
  await page.locator("#unlock").click();
  await expect(page.locator("#status")).toHaveText(/Audio context/);
});
