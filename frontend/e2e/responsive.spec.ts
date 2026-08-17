import { expect, test } from "@playwright/test";

const viewportMatrix = [
  { name: "small-mobile", width: 320, height: 568 },
  { name: "android-small", width: 360, height: 640 },
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone", width: 390, height: 844 },
  { name: "iphone-15", width: 393, height: 852 },
  { name: "android-large", width: 412, height: 915 },
  { name: "iphone-max", width: 430, height: 932 },
  { name: "mobile-landscape-small", width: 667, height: 375 },
  { name: "mobile-landscape", width: 844, height: 390 },
  { name: "mobile-landscape-large", width: 932, height: 430 },
  { name: "tablet-small", width: 600, height: 960 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "ipad-10", width: 810, height: 1080 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "ipad-air", width: 834, height: 1194 },
  { name: "ipad-pro-portrait", width: 1024, height: 1366 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "ipad-air-landscape", width: 1194, height: 834 },
  { name: "ipad-pro-landscape", width: 1366, height: 1024 },
  { name: "desktop-small", width: 1280, height: 720 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "desktop-wide", width: 1536, height: 864 },
  { name: "tv-1080", width: 1920, height: 1080 },
  { name: "desktop-1440p", width: 2560, height: 1440 },
  { name: "tv-4k", width: 3840, height: 2160 },
];

test("homepage remains usable without horizontal overflow across the device matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "matrix runs once in the desktop browser project");
  test.setTimeout(180_000);

  for (const viewport of viewportMatrix) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${viewport.name} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test("TV arrow navigation creates a visible predictable focus target", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "TV navigation runs once in the desktop browser project");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.keyboard.press("ArrowDown");

  const focused = page.locator(":focus");
  await expect(focused).toHaveCount(1);
  await expect(focused).toHaveAttribute("href", "/");
  const outline = await focused.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
});

test("match page uses one responsive match summary DOM", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "single DOM regression runs once");
  await page.goto("/");
  const matchLink = page.locator('a[href^="/match/"]').first();
  const href = await matchLink.getAttribute("href");
  if (!href) {
    test.skip(true, "No public match is available in this environment.");
    return;
  }

  await page.goto(href);
  await expect(page.locator(".match-layout")).toHaveCount(1);
  await expect(page.locator(".match-layout h2").filter({ hasText: / vs /i })).toHaveCount(1);

  for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 820 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
