/**
 * apps/web/e2e/auth/login.spec.ts — I-105c
 *
 * E2E: visit /, expect redirect to /login?redirect=/, fill form, submit,
 * BFF stubbed to return tokens + Set-Cookie, expect redirect to /dashboard.
 */
import { test, expect } from "@playwright/test";

test.describe("login flow", () => {
  test("redirects to /login?redirect=/ when visiting / unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?redirect=%2F/);
  });

  test("login form: successful submit redirects to /dashboard", async ({ page }) => {
    // Stub BFF login + whoami
    await page.route("**/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "sa_access_token=fake-access; Path=/; HttpOnly; SameSite=Lax",
        },
        body: JSON.stringify({
          userId: "11111111-1111-1111-1111-111111111111",
          accessToken: "fake-access",
          accessExpiresAt: "2030-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel(/email/i).fill("alice@acme.test");
    await page.getByLabel(/mật khẩu/i).fill("PlainP@ss123");
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Wait for navigation triggered by router.push
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("login form: shows error on 401", async ({ page }) => {
    await page.route("**/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        headers: { "Content-Type": "application/json" },
        body: "Invalid credentials",
      });
    });

    await page.goto("/login");
    await page.getByLabel(/email/i).fill("alice@acme.test");
    await page.getByLabel(/mật khẩu/i).fill("WrongPassword1");
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    await expect(page.getByText(/email hoặc mật khẩu không đúng/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
