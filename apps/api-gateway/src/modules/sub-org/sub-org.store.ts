/**
 * apps/api-gateway/src/modules/sub-org/sub-org.store.ts
 *
 * I-905 — In-memory sub-org store. Phase 10 swap sang Postgres
 * `organizations` table + recursive CTE for hierarchy.
 */
import { Injectable, Logger } from "@nestjs/common";
import type { Organization, OrganizationInput, OrganizationUpdate } from "./sub-org.types";

export interface ISubOrgStore {
  get(id: string): Promise<Organization | null>;
  listByParent(parentOrgId: string | null): Promise<Organization[]>;
  listRoots(tenantId: string): Promise<Organization[]>;
  create(
    rootTenantId: string,
    input: OrganizationInput,
    parent: Organization | null,
    depth: number,
  ): Promise<Organization>;
  update(id: string, tenantId: string, patch: OrganizationUpdate): Promise<Organization | null>;
  delete(id: string, tenantId: string): Promise<boolean>;
}

@Injectable()
export class InMemorySubOrgStore implements ISubOrgStore {
  private readonly logger = new Logger(InMemorySubOrgStore.name);
  private readonly orgs = new Map<string, Organization>();
  private idCounter = 0;

  private nextId(): string {
    this.idCounter += 1;
    return `org_${Date.now().toString(36)}_${this.idCounter.toString(36)}`;
  }

  async get(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }

  async listByParent(parentOrgId: string | null): Promise<Organization[]> {
    return [...this.orgs.values()].filter((o) => o.parentOrgId === parentOrgId);
  }

  async listRoots(tenantId: string): Promise<Organization[]> {
    // Tenant root = the org with same id as tenantId
    return [...this.orgs.values()].filter((o) => o.id === tenantId || o.tenantId === tenantId && o.parentOrgId === null);
  }

  async create(
    rootTenantId: string,
    input: OrganizationInput,
    parent: Organization | null,
    depth: number,
  ): Promise<Organization> {
    const now = new Date().toISOString();
    const org: Organization = {
      id: this.nextId(),
      tenantId: parent ? parent.id : rootTenantId,
      parentOrgId: parent?.id ?? null,
      name: input.name,
      slug: input.slug,
      plan: input.plan ?? null,
      settings: input.settings ?? {},
      active: true,
      depth,
      createdAt: now,
      updatedAt: now,
    };
    this.orgs.set(org.id, org);
    this.logger.log(`org created ${org.id} parent=${org.parentOrgId} depth=${depth}`);
    return org;
  }

  async update(id: string, _tenantId: string, patch: OrganizationUpdate): Promise<Organization | null> {
    const existing = this.orgs.get(id);
    if (!existing) return null;
    const updated: Organization = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.orgs.set(id, updated);
    return updated;
  }

  async delete(id: string, _tenantId: string): Promise<boolean> {
    return this.orgs.delete(id);
  }
}
