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
  await expect(page.getByText("1 match")).toBeVisible();

  // When there ARE matches for today:
  // - We show "Today" heading and match count
  // - We show the HomeSignal component with "Next match" text (for the featured match)
  // - We show match cards
  // - We do NOT show the NoMatchesToday section

  await expect(page.getByText("No matches today")).toBeHidden();
  await expect(page.getByRole("link", { name: "View Matches" })).toBeHidden(); // Only in NoMatchesToday

  // We SHOULD see "Next match" in the HomeSignal component (for scheduled matches)
  await expect(page.getByText("Next match")).toBeVisible();

  // We SHOULD see the match card for Fulham vs Chelsea
  await expect(page.locator('a[href^="/match/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View match" })).toBeVisible(); // On the match card itself
});

test("past match shows as broadcast ended", async ({ page }) => {
  await page.goto("/match/arsenal-vs-coventry-city-2026-08-21");
  await expect(page.getByRole("heading", { level: 1, name: "Arsenal vs Coventry City" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Broadcast ended" })).toBeVisible();
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
