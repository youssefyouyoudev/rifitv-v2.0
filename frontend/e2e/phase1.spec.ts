import { expect, test } from "@playwright/test";

const adminEmail = process.env.RIFITV_E2E_ADMIN_EMAIL;
const adminPassword = process.env.RIFITV_E2E_ADMIN_PASSWORD;

test.beforeEach(({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  Reflect.set(page, "consoleErrors", consoleErrors);
});

test.afterEach(({ page }) => {
  const errors = (Reflect.get(page, "consoleErrors") as string[] | undefined ?? []).filter((message) =>
    /hydration|did not match|Encountered a script tag|uncaught|React/i.test(message),
  );

  expect(errors).toEqual([]);
});

test("homepage loads today's production surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByText("No matches today")).toBeVisible();
  await expect(page.getByText("Next match").first()).toBeVisible();
  await expect(page.locator('a[href^="/match/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Matches" })).toBeVisible();
});

test("future match opens with prematch countdown and no source disclosure", async ({ page }) => {
  await page.goto("/match/arsenal-vs-coventry-city-premier-league-2026-27-pl-2026-27-001");
  await expect(page.getByRole("heading", { level: 1, name: "Arsenal vs Coventry City" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stream available soon" })).toBeVisible();
  await expect(page.getByText("Stream available in")).toBeVisible();
  await expect(page.getByLabel("Available broadcast sources")).toHaveCount(0);
  await expect(page.getByText("beIN SPORTS MENA")).toBeVisible();
  await expect(page.getByText("Channel assignment TBC")).toBeVisible();
});

test("admin route requires authentication", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
});

test("admin can login and open match management", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Admin e2e credentials are not configured.");
  await page.goto("/admin/matches");
  await page.getByLabel("Email").fill(adminEmail!);
  await page.getByLabel("Password").fill(adminPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Matches" })).toBeVisible();
  await expect(page.getByText("+ Quick Match")).toBeVisible();
});

test("admin live control can update a score", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Admin e2e credentials are not configured.");
  await page.goto("/admin/matches/1/live");
  await page.getByLabel("Email").fill(adminEmail!);
  await page.getByLabel("Password").fill(adminPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Live Control" })).toBeVisible();
  await page.locator("button", { hasText: "+" }).first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Live match saved")).toBeVisible();
});

test("admin can open operations dashboard", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Admin e2e credentials are not configured.");
  await page.goto("/admin/operations");
  await page.getByLabel("Email").fill(adminEmail!);
  await page.getByLabel("Password").fill(adminPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Operations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manual Operations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Alerts" })).toBeVisible();
});

test("mobile layout exposes thumb navigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
});
