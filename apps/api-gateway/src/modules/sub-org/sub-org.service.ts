/**
 * apps/api-gateway/src/modules/sub-org/sub-org.service.ts
 *
 * I-905 — Service: CRUD + hierarchy traversal + plan gate.
 *
 * Plan gate (parent's plan):
 *   - free: 0 sub-orgs
 *   - pro: max 3, depth 2
 *   - enterprise: max 50, depth 3
 *
 * Permission check: chỉ Owner của parent mới tạo child.
 * Phase 9 hardcode: middleware check `req.user.role === 'owner'`.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InMemorySubOrgStore, type ISubOrgStore } from "./sub-org.store";
import {
  SUBORG_MAX_DEPTH,
  SUBORG_NAME_MAX_LENGTH,
  SUBORG_PLAN_QUOTAS,
  SUBORG_SLUG_PATTERN,
  type Organization,
  type OrganizationInput,
  type OrganizationNode,
  type OrganizationUpdate,
} from "./sub-org.types";

@Injectable()
export class SubOrgService {
  private readonly logger = new Logger(SubOrgService.name);

  constructor(private readonly store: ISubOrgStore) {}

  async create(
    rootTenantId: string,
    parentOrgId: string,
    input: OrganizationInput,
    callerRole: string,
  ): Promise<Organization> {
    // Permission
    if (callerRole !== "owner") {
      throw new ForbiddenException("only Owner can create sub-orgs");
    }
    // Validation
    if (!input.name || input.name.length > SUBORG_NAME_MAX_LENGTH) {
      throw new BadRequestException(`name max ${SUBORG_NAME_MAX_LENGTH} chars`);
    }
    if (!SUBORG_SLUG_PATTERN.test(input.slug)) {
      throw new BadRequestException("slug must match /^[a-z][a-z0-9-]{1,62}$/");
    }
    // Slug unique trong scope parent
    const siblings = await this.store.listByParent(parentOrgId);
    if (siblings.some((s) => s.slug === input.slug)) {
      throw new ConflictException(`slug "${input.slug}" already used in parent`);
    }
    // Parent exists
    const parent = await this.store.get(parentOrgId);
    if (!parent) throw new NotFoundException("parent org not found");
    if (!parent.active) throw new BadRequestException("parent org is suspended");
    // Plan gate
    const parentPlan = parent.plan ?? "free";
    const quota = SUBORG_PLAN_QUOTAS[parentPlan] ?? SUBORG_PLAN_QUOTAS.free;
    if (quota.maxSubOrgs === 0) {
      throw new ForbiddenException(`plan ${parentPlan} does not allow sub-orgs`);
    }
    const newDepth = parent.depth + 1;
    if (newDepth > quota.maxDepth || newDepth > SUBORG_MAX_DEPTH) {
      throw new ForbiddenException(`max depth ${Math.min(quota.maxDepth, SUBORG_MAX_DEPTH)} exceeded`);
    }
    // Count quota
    const allChildren = await this.collectDescendants(parentOrgId);
    if (allChildren.length >= quota.maxSubOrgs) {
      throw new ForbiddenException(`plan ${parentPlan} reached sub-org quota (${quota.maxSubOrgs})`);
    }

    // Inherit plan from parent if not explicitly set
    const inputWithPlan = { ...input, plan: input.plan ?? parent.plan ?? null };
    return this.store.create(rootTenantId, inputWithPlan, parent, newDepth);
  }

  async update(
    id: string,
    tenantId: string,
    patch: OrganizationUpdate,
    callerRole: string,
  ): Promise<Organization> {
    if (callerRole !== "owner") {
      throw new ForbiddenException("only Owner can update sub-org");
    }
    const existing = await this.store.get(id);
    if (!existing) throw new NotFoundException("org not found");
    if (patch.slug !== undefined) {
      if (!SUBORG_SLUG_PATTERN.test(patch.slug)) {
        throw new BadRequestException("slug must match /^[a-z][a-z0-9-]{1,62}$/");
      }
      // Uniqueness vs siblings
      const siblings = await this.store.listByParent(existing.parentOrgId);
      if (siblings.some((s) => s.slug === patch.slug && s.id !== id)) {
        throw new ConflictException(`slug "${patch.slug}" already used`);
      }
    }
    const updated = await this.store.update(id, tenantId, patch);
    if (!updated) throw new NotFoundException("org not found");
    return updated;
  }

  async remove(id: string, tenantId: string, callerRole: string): Promise<void> {
    if (callerRole !== "owner") {
      throw new ForbiddenException("only Owner can delete sub-org");
    }
    const existing = await this.store.get(id);
    if (!existing) throw new NotFoundException("org not found");
    if (existing.id === tenantId) {
      throw new BadRequestException("cannot delete root tenant org");
    }
    // Cascade: delete all descendants
    const all = [existing, ...(await this.collectDescendants(id))];
    for (const o of all) {
      await this.store.delete(o.id, tenantId);
    }
    this.logger.log(`sub-org cascade delete ${id} descendants=${all.length - 1}`);
  }

  async getTree(rootOrgId: string, tenantId: string): Promise<OrganizationNode> {
    const root = await this.store.get(rootOrgId);
    if (!root) throw new NotFoundException("root org not found");
    if (root.tenantId !== tenantId && root.id !== tenantId) {
      throw new ForbiddenException("cross-tenant access denied");
    }
    return this.buildNode(root, []);
  }

  async getDescendants(orgId: string, tenantId: string): Promise<Organization[]> {
    const root = await this.store.get(orgId);
    if (!root) throw new NotFoundException("org not found");
    if (root.tenantId !== tenantId && root.id !== tenantId) {
      throw new ForbiddenException("cross-tenant access denied");
    }
    return this.collectDescendants(orgId);
  }

  // ─── helpers ──────────────────────────────────────────────────────

  private async buildNode(org: Organization, path: string[]): Promise<OrganizationNode> {
    const children = await this.store.listByParent(org.id);
    const childNodes = await Promise.all(children.map((c) => this.buildNode(c, [...path, org.id])));
    return { ...org, children: childNodes, path: [...path, org.id] };
  }

  private async collectDescendants(rootId: string): Promise<Organization[]> {
    const all: Organization[] = [];
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const children = await this.store.listByParent(id);
      for (const c of children) {
        all.push(c);
        queue.push(c.id);
      }
    }
    return all;
  }
}

export const _Store = InMemorySubOrgStore;
