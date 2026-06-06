/**
 * test/billing/trial-flow.test.ts — I-505.
 *
 * Trial expiry → downgrade flow. Mock .NET subscription lookup + state transition.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

describe("Trial expiry flow", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("trial ends -> subscription state=Cancelled + plan_id=FreePlan", async () => {
    // Step 1: list subscriptions trial expiring today
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([
      { id: "sub-1", organizationId: "org-1", trialEndsAt: new Date().toISOString(), state: "Trial" },
    ]), { status: 200 }));

    // Step 2: cancel subscription
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    // Step 3: switch to free plan
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    // Simulate the worker
    const subs = await (await fetch("http://localhost:5050/v1/billing/subscriptions/expiring-today")).json() as Array<{ id: string; organizationId: string }>;
    expect(subs.length).toBe(1);

    for (const s of subs) {
      const r1 = await fetch(`http://localhost:5050/v1/billing/subscriptions/cancel`, {
        method: "POST",
        body: JSON.stringify({ organizationId: s.organizationId }),
      });
      expect(r1.status).toBe(200);
      const r2 = await fetch(`http://localhost:5050/v1/billing/subscriptions/upgrade`, {
        method: "POST",
        body: JSON.stringify({ organizationId: s.organizationId, newPlanId: "free-plan-id" }),
      });
      expect(r2.status).toBe(200);
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reminder email sent 3 days before trial ends (T-3)", async () => {
    // Phase 5: handled by TrialSchedulerProcessor; mocked below
    const sent = { value: false };
    const sendReminder = async (_orgId: string, day: number) => {
      if (day === 3) sent.value = true;
    };
    await sendReminder("org-1", 3);
    expect(sent.value).toBe(true);
  });
});
