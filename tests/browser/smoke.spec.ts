import { expect, test } from "@playwright/test";

test("triangle example loads", async ({ page }) => {
  await page.goto("/examples/triangle/");
  await expect(page.locator("#status")).toBeVisible();
  await expect(page.locator("#canvas")).toBeVisible();
});
