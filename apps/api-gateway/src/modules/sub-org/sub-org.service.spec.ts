/**
 * apps/api-gateway/src/modules/sub-org/sub-org.service.spec.ts
 *
 * I-905 — Sub-org service tests.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySubOrgStore } from "./sub-org.store";
import { SubOrgService } from "./sub-org.service";
import type { Organization } from "./sub-org.types";

describe("SubOrgService", () => {
  let store: InMemorySubOrgStore;
  let service: SubOrgService;

  beforeEach(() => {
    store = new InMemorySubOrgStore();
    service = new SubOrgService(store);
  });

  async function createRoot(plan = "enterprise"): Promise<Organization> {
    return store.create("root_tenant", { name: "Root", slug: "root", plan }, null, 0);
  }

  describe("create", () => {
    it("creates a child org for enterprise parent", async () => {
      const root = await createRoot("enterprise");
      const child = await service.create(
        "root_tenant",
        root.id,
        { name: "Branch A", slug: "branch-a" },
        "owner",
      );
      expect(child.parentOrgId).toBe(root.id);
      expect(child.depth).toBe(1);
    });

    it("rejects non-owner caller", async () => {
      const root = await createRoot("enterprise");
      await expect(
        service.create("root_tenant", root.id, { name: "X", slug: "x-org" }, "admin"),
      ).rejects.toThrow(/Owner/);
    });

    it("rejects invalid slug", async () => {
      const root = await createRoot("enterprise");
      await expect(
        service.create("root_tenant", root.id, { name: "X", slug: "Bad Slug!" }, "owner"),
      ).rejects.toThrow(/slug/);
    });

    it("rejects duplicate slug in same parent", async () => {
      const root = await createRoot("enterprise");
      await service.create("root_tenant", root.id, { name: "A", slug: "shared" }, "owner");
      await expect(
        service.create("root_tenant", root.id, { name: "B", slug: "shared" }, "owner"),
      ).rejects.toThrow(/already used/);
    });

    it("rejects free plan (no sub-orgs allowed)", async () => {
      const root = await createRoot("free");
      await expect(
        service.create("root_tenant", root.id, { name: "A", slug: "a-org" }, "owner"),
      ).rejects.toThrow(/does not allow/);
    });

    it("rejects exceeding depth (pro: max 2)", async () => {
      const root = await createRoot("pro");
      const c1 = await service.create("root_tenant", root.id, { name: "C1", slug: "c1" }, "owner");
      const c2 = await service.create("root_tenant", c1.id, { name: "C2", slug: "c2" }, "owner");
      await expect(
        service.create("root_tenant", c2.id, { name: "C3", slug: "c3" }, "owner"),
      ).rejects.toThrow(/depth/);
    });

    it("rejects exceeding quota (pro: 3 sub-orgs)", async () => {
      const root = await createRoot("pro");
      await service.create("root_tenant", root.id, { name: "A", slug: "aa" }, "owner");
      await service.create("root_tenant", root.id, { name: "B", slug: "bb" }, "owner");
      await service.create("root_tenant", root.id, { name: "C", slug: "cc" }, "owner");
      await expect(
        service.create("root_tenant", root.id, { name: "D", slug: "dd" }, "owner"),
      ).rejects.toThrow(/quota/);
    });

    it("rejects suspended parent", async () => {
      const root = await createRoot("enterprise");
      await store.update(root.id, "root_tenant", { active: false });
      await expect(
        service.create("root_tenant", root.id, { name: "X", slug: "x-org" }, "owner"),
      ).rejects.toThrow(/suspended/);
    });
  });

  describe("getTree", () => {
    it("builds nested tree", async () => {
      const root = await createRoot("enterprise");
      const c1 = await service.create("root_tenant", root.id, { name: "C1", slug: "c1" }, "owner");
      const c2 = await service.create("root_tenant", c1.id, { name: "C2", slug: "c2" }, "owner");
      const tree = await service.getTree(root.id, "root_tenant");
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].id).toBe(c1.id);
      expect(tree.children[0].children).toHaveLength(1);
      expect(tree.children[0].children[0].id).toBe(c2.id);
    });

    it("rejects cross-tenant tree access", async () => {
      const root = await createRoot("enterprise");
      await expect(service.getTree(root.id, "other_tenant")).rejects.toThrow(/cross-tenant/);
    });
  });

  describe("getDescendants", () => {
    it("returns flat list of all descendants", async () => {
      const root = await createRoot("enterprise");
      const c1 = await service.create("root_tenant", root.id, { name: "C1", slug: "c1" }, "owner");
      await service.create("root_tenant", c1.id, { name: "C2", slug: "c2" }, "owner");
      await service.create("root_tenant", root.id, { name: "C3", slug: "c3" }, "owner");
      const desc = await service.getDescendants(root.id, "root_tenant");
      expect(desc).toHaveLength(3);
    });
  });

  describe("remove", () => {
    it("cascades to descendants", async () => {
      const root = await createRoot("enterprise");
      const c1 = await service.create("root_tenant", root.id, { name: "C1", slug: "c1" }, "owner");
      await service.create("root_tenant", c1.id, { name: "C2", slug: "c2" }, "owner");
      await service.remove(c1.id, "root_tenant", "owner");
      const desc = await service.getDescendants(root.id, "root_tenant");
      expect(desc).toHaveLength(0);
    });

    it("rejects non-owner delete", async () => {
      const root = await createRoot("enterprise");
      const c1 = await service.create("root_tenant", root.id, { name: "C1", slug: "c1" }, "owner");
      await expect(service.remove(c1.id, "root_tenant", "admin")).rejects.toThrow(/Owner/);
    });
  });

  describe("update", () => {
    it("updates name", async () => {
      const root = await createRoot("enterprise");
      const c1 = await service.create("root_tenant", root.id, { name: "C1", slug: "c1" }, "owner");
      const updated = await service.update(c1.id, "root_tenant", { name: "Renamed" }, "owner");
      expect(updated.name).toBe("Renamed");
    });

    it("rejects duplicate slug on update", async () => {
      const root = await createRoot("enterprise");
      await service.create("root_tenant", root.id, { name: "A", slug: "aa" }, "owner");
      const c2 = await service.create("root_tenant", root.id, { name: "B", slug: "bb" }, "owner");
      await expect(service.update(c2.id, "root_tenant", { slug: "aa" }, "owner")).rejects.toThrow(/already used/);
    });
  });
});
