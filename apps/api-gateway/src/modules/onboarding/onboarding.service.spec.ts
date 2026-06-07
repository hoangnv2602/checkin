/**
 * apps/api-gateway/src/modules/onboarding/onboarding.service.test.ts
 *
 * I-703 — Unit test cho OnboardingService state machine.
 * Verify: default state, idempotent advance, skip → dismissed, reset → fresh.
 */
import { describe, it, expect, beforeEach } from "vitest";

/**
 * Minimal in-memory Redis stub — supports only the verbs OnboardingService uses:
 *  - get(key) → string | null
 *  - set(key, value, "EX", ttlSeconds)
 *  - del(key) → count
 *  - ttl(key) → seconds
 */
function makeFakeRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ...args: unknown[]): Promise<"OK"> {
      let ttl = 0;
      if (args[0] === "EX" && typeof args[1] === "number") ttl = args[1] * 1000;
      store.set(key, { value, expiresAt: Date.now() + ttl });
      return "OK";
    },
    async del(key: string): Promise<number> {
      return store.delete(key) ? 1 : 0;
    },
    async ttl(key: string): Promise<number> {
      const entry = store.get(key);
      if (!entry) return -2;
      const remainingMs = entry.expiresAt - Date.now();
      return Math.max(0, Math.floor(remainingMs / 1000));
    },
  };
}

type FakeRedis = ReturnType<typeof makeFakeRedis>;

import { OnboardingService, OnboardingStep, ONBOARDING_STEPS } from "./onboarding.service";

class TestableOnboardingService extends OnboardingService {
  setRedis(client: FakeRedis): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).redis = client;
  }
}

describe("OnboardingService", () => {
  let redis: FakeRedis;
  let svc: TestableOnboardingService;

  beforeEach(() => {
    redis = makeFakeRedis();
    svc = new TestableOnboardingService(redis as never);
    svc.setRedis(redis);
  });

  it("returns a fresh default state for an unseen user", async () => {
    const state = await svc.getState("user-1");
    expect(state.currentStep).toBe(OnboardingStep.ConfirmEmail);
    expect(state.highestCompletedStep).toBeNull();
    expect(state.dismissed).toBe(false);
    expect(state.data).toEqual({});
  });

  it("advances through the 5 steps in order", async () => {
    for (const step of ONBOARDING_STEPS) {
      const next = await svc.advance("user-1", step);
      expect(next.highestCompletedStep).toBe(step);
    }
    const final = await svc.getState("user-1");
    expect(final.highestCompletedStep).toBe(OnboardingStep.Share);
  });

  it("is idempotent: re-advancing the same step does not regress", async () => {
    await svc.advance("user-1", OnboardingStep.ConfirmEmail);
    await svc.advance("user-1", OnboardingStep.CreateEvent, { eventId: "evt-1" });
    const before = await svc.getState("user-1");
    // Try to "re-do" the email step — must not regress
    const after = await svc.advance("user-1", OnboardingStep.ConfirmEmail);
    expect(after.highestCompletedStep).toBe(before.highestCompletedStep);
    expect(after.data.eventId).toBe("evt-1");
  });

  it("merges data into state", async () => {
    await svc.advance("user-1", OnboardingStep.CreateEvent, { eventId: "evt-1" });
    await svc.advance("user-1", OnboardingStep.AddStaff, { staffEmails: ["a@x.com"] });
    const state = await svc.getState("user-1");
    expect(state.data.eventId).toBe("evt-1");
    expect(state.data.staffEmails).toEqual(["a@x.com"]);
  });

  it("skip sets dismissed=true and persists", async () => {
    await svc.advance("user-1", OnboardingStep.ConfirmEmail);
    await svc.skip("user-1");
    const state = await svc.getState("user-1");
    expect(state.dismissed).toBe(true);
  });

  it("reset clears dismissed and step progress", async () => {
    await svc.advance("user-1", OnboardingStep.Publish, { eventId: "evt-1" });
    await svc.skip("user-1");
    await svc.reset("user-1");
    const state = await svc.getState("user-1");
    expect(state.dismissed).toBe(false);
    expect(state.highestCompletedStep).toBeNull();
    expect(state.data).toEqual({});
  });

  it("TTL is 90 days", async () => {
    await svc.getState("user-1");
    const ttl = await redis.ttl("onboarding:user-1");
    // 90 days = 7_776_000 seconds, allow ±10s for test execution
    expect(ttl).toBeGreaterThan(7_775_000);
    expect(ttl).toBeLessThanOrEqual(7_776_000);
  });
});
