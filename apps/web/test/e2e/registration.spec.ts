/**
 * apps/web/test/e2e/registration.spec.ts — I-306 Phase 3 E2E (Playwright).
 *
 * Flow: register → pay (Stripe test mode) → email + QR.
 * Stubbed Stripe session (dev mode) bypasses real Stripe.
 *
 * Pre-req:
 *   - core-api running on :5050
 *   - api-gateway running on :3001
 *   - web running on :3000
 *   - Postgres + Redis up
 *   - Seed: 1 org + 1 published event with 1 ticket type
 */
import { test, expect } from "@playwright/test";

const ORG_SLUG = "acme";
const EVENT_ID = process.env.SEED_EVENT_ID ?? "00000000-0000-0000-0000-000000000000";

test.describe("Public registration flow", () => {
  test("attendee can browse event and submit form", async ({ page }) => {
    await page.goto(`/e/${ORG_SLUG}/event/${EVENT_ID}`);
    await expect(page.locator("h1")).toContainText("Tech Conference");
    await expect(page.getByRole("link", { name: "Register" }).first()).toBeVisible();
  });

  test("form validation rejects invalid email", async ({ page }) => {
    await page.goto(`/e/${ORG_SLUG}/register?eventId=${EVENT_ID}`);
    await page.locator("input[type=email]").fill("not-an-email");
    await page.locator("button[type=submit]").click();
    await expect(page.getByText("Invalid email")).toBeVisible();
  });

  test("submit redirects to /register/pay with order summary", async ({ page }) => {
    await page.goto(`/e/${ORG_SLUG}/register?eventId=${EVENT_ID}`);
    await page.locator("input[name=buyerName], #buyerName").fill("Jane Doe");
    await page.locator("input[type=email]").fill("jane@example.com");
    await page.locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/register\/pay/);
    await expect(page.getByText("Confirm and pay")).toBeVisible();
  });

  test("pay button hits Stripe test stub and returns success", async ({ page }) => {
    await page.goto(`/e/${ORG_SLUG}/register?eventId=${EVENT_ID}`);
    await page.locator("#buyerName").fill("Jane Doe");
    await page.locator("input[type=email]").fill("jane@example.com");
    await page.locator("button[type=submit]").click();
    await page.waitForURL(/\/register\/pay/);
    // Click pay, expect redirect to success
    await page.getByRole("button", { name: /Pay with/ }).click();
    // dev stub auto-redirects to success URL with ?dev=1
    await page.waitForURL(/\/register\/success/, { timeout: 15_000 });
    await expect(page.getByText("Thank you!")).toBeVisible();
  });
});
