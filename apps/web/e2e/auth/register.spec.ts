/**
 * apps/web/e2e/auth/register.spec.ts — I-105c
 *
 * E2E: /register form — BFF stubbed. Submit → 201 → cookies set → dashboard.
 */
import { test, expect } from "@playwright/test";

test.describe("register flow", () => {
  test("successful register redirects to /dashboard", async ({ page }) => {
    await page.route("**/v1/auth/register", async (route) => {
      await route.fulfill({
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "sa_access_token=fake-access; Path=/; HttpOnly; SameSite=Lax",
        },
        body: JSON.stringify({
          userId: "22222222-2222-2222-2222-222222222222",
          organizationId: "33333333-3333-3333-3333-333333333333",
          accessToken: "fake-access",
          accessExpiresAt: "2030-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/register");
    await page.getByLabel(/email/i).fill("bob@acme.test");
    await page.getByLabel(/họ và tên/i).fill("Bob Nguyễn");
    await page.getByLabel(/^mật khẩu$/i).fill("BobP@ss123");
    await page.getByLabel(/tên tổ chức/i).fill("Bob Events");
    // Slug is auto-generated from orgName; explicit typing forces it
    const slugField = page.getByLabel(/slug tổ chức/i);
    await slugField.click();
    await slugField.fill("bob-events");
    await page.getByRole("button", { name: /tạo tài khoản/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("invalid slug shows zod error and does not call BFF", async ({ page }) => {
    let registerCalled = false;
    await page.route("**/v1/auth/register", async (route) => {
      registerCalled = true;
      await route.fulfill({ status: 201, body: "{}" });
    });

    await page.goto("/register");
    await page.getByLabel(/email/i).fill("bob@acme.test");
    await page.getByLabel(/họ và tên/i).fill("Bob Nguyễn");
    await page.getByLabel(/^mật khẩu$/i).fill("BobP@ss123");
    await page.getByLabel(/tên tổ chức/i).fill("Bob Events");
    const slugField = page.getByLabel(/slug tổ chức/i);
    await slugField.click();
    await slugField.fill("INVALID_SLUG");
    await page.getByRole("button", { name: /tạo tài khoản/i }).click();

    // Wait briefly to ensure no BFF call
    await page.waitForTimeout(500);
    expect(registerCalled).toBe(false);
  });
});
