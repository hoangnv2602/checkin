/**
 * apps/web/e2e/auth/middleware-redirect.spec.ts — I-105c
 *
 * E2E: middleware redirect to /login?redirect=<path> when no access cookie.
 */
import { test, expect } from "@playwright/test";

test.describe("middleware redirect", () => {
  test("/dashboard without cookie redirects to /login?redirect=/dashboard", async ({ page }) => {
    const res = await page.goto("/dashboard");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test("/dashboard with cookie passes through (no redirect)", async ({ page, context }) => {
    // Inject a fake access cookie
    await context.addCookies([
      {
        name: "sa_access_token",
        value: "fake-cookie-value",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    // Don't expect a real dashboard render — middleware only checks presence.
    // Visiting /dashboard should NOT redirect to /login.
    await page.goto("/dashboard");
    expect(page.url()).not.toContain("/login");
  });

  test("/login is public (no redirect)", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/register is public (no redirect)", async ({ page }) => {
    const res = await page.goto("/register");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/register/);
  });
});
