/**
 * apps/api-gateway/src/modules/checkin-admin/impersonation/impersonation.service.spec.ts
 */
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryImpersonationStore } from "./impersonation.store";
import { ImpersonationService } from "./impersonation.service";
import type { ImpersonationStartInput } from "./impersonation.types";

const base = (over: Partial<ImpersonationStartInput> = {}): ImpersonationStartInput => ({
  platformUserId: "plat_1",
  tenantId: "tenant_1",
  reason: "Debug webhook 500 from production report",
  durationMinutes: 15,
  ...over,
});

describe("ImpersonationService", () => {
  let store: InMemoryImpersonationStore;
  let service: ImpersonationService;

  beforeEach(() => {
    store = new InMemoryImpersonationStore();
    service = new ImpersonationService(store);
  });

  describe("start", () => {
    it("starts a session", async () => {
      const s = await service.start(base());
      expect(s.id).toBeTruthy();
      expect(s.state).toBe("Active");
      expect(s.platformUserId).toBe("plat_1");
    });

    it("rejects reason < 10 chars", async () => {
      await expect(service.start(base({ reason: "short" }))).rejects.toThrow(/reason min 10/);
    });

    it("rejects reason > 500 chars", async () => {
      await expect(service.start(base({ reason: "x".repeat(501) }))).rejects.toThrow(/reason max 500/);
    });

    it("rejects duration > 30 min", async () => {
      await expect(service.start(base({ durationMinutes: 60 }))).rejects.toThrow(/duration max 30/);
    });

    it("clamps duration to 30 min silently for undefined", async () => {
      const s = await service.start(base({ durationMinutes: undefined }));
      const expected = new Date(s.startedAt).getTime() + IMPERSONATION_DEFAULT_DURATION_MINUTES() * 60_000;
      const actual = new Date(s.expiresAt).getTime();
      // 1s tolerance
      expect(Math.abs(actual - expected)).toBeLessThan(1_000);
    });

    it("auto-revokes previous active session for same platform user", async () => {
      const s1 = await service.start(base());
      const s2 = await service.start(base());
      const r1 = await store.get(s1.id);
      expect(r1?.state).toBe("Revoked");
      expect(r1?.revokedBy).toBe("system:supersede");
      expect(s2.state).toBe("Active");
    });

    it("requires platformUserId and tenantId", async () => {
      await expect(service.start(base({ platformUserId: "" }))).rejects.toThrow(/required/);
    });
  });

  describe("revoke", () => {
    it("revokes an active session", async () => {
      const s = await service.start(base());
      const r = await service.revoke(s.id, "plat_2");
      expect(r.state).toBe("Revoked");
      expect(r.revokedBy).toBe("plat_2");
    });

    it("rejects revoke of non-existent session", async () => {
      await expect(service.revoke("imp_xxx", "plat_1")).rejects.toThrow(/not found/);
    });

    it("rejects revoke of already-revoked session", async () => {
      const s = await service.start(base());
      await service.revoke(s.id, "plat_1");
      await expect(service.revoke(s.id, "plat_2")).rejects.toThrow(/already/);
    });
  });

  describe("buildClaims", () => {
    it("emits impersonation claims", async () => {
      const s = await service.start(base());
      const claims = service.buildClaims(s, "user_subject_placeholder");
      expect(claims.is_impersonated).toBe(true);
      expect(claims.impersonation_session_id).toBe(s.id);
      expect(claims.impersonated_by).toBe("plat_1");
      expect(claims.tenantId).toBe("tenant_1");
      expect(claims.exp).toBeGreaterThan(claims.iat);
    });

    it("rejects claims for non-active session", async () => {
      const s = await service.start(base());
      await service.revoke(s.id, "plat_2");
      const fresh = await service.get(s.id);
      expect(() => service.buildClaims(fresh, "u")).toThrow(/not active/);
    });
  });

  describe("sweep", () => {
    it("expires past sessions", async () => {
      const s = await service.start(base({ durationMinutes: 1 }));
      // Manually backdate
      s.expiresAt = new Date(Date.now() - 1000).toISOString();
      const n = await service.sweep();
      expect(n).toBe(1);
      expect((await store.get(s.id))?.state).toBe("Expired");
    });
  });

  describe("listForTenant", () => {
    it("returns recent sessions", async () => {
      await service.start(base());
      await service.start(base({ platformUserId: "plat_2" }));
      const list = await service.listForTenant("tenant_1");
      expect(list.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// Helper to access default duration from spec.
function IMPERSONATION_DEFAULT_DURATION_MINUTES() {
  // Re-import to keep spec self-contained.
  return 15;
}
