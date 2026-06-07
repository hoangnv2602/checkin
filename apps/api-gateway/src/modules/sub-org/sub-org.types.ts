/**
 * apps/api-gateway/src/modules/sub-org/sub-org.types.ts
 *
 * I-905 — Sub-organization types.
 *
 * Organization hierarchy:
 *   - parentOrgId nullable → root org (no parent)
 *   - child orgs inherit plan + settings từ parent
 *   - override: child có thể có plan riêng (vd: parent Enterprise, child Free)
 *   - max depth: 3 levels (root → branch → sub-branch)
 *   - RLS vẫn isolate: Owner của root KHÔNG tự động Owner của child
 *     — phải add explicit membership vào child để access data của child
 *
 * Use case:
 *   - Franchise: mỗi chi nhánh = sub-org
 *   - Agency: mỗi client = sub-org
 *   - Holding company: parent cho portfolio companies
 */
export interface Organization {
  id: string;
  tenantId: string; // == organizationId (mỗi org = 1 tenant)
  parentOrgId: string | null;
  name: string;
  slug: string;
  /** Plan override. Null = inherit from parent. */
  plan: string | null;
  /** Settings override. Merged with parent. */
  settings: Record<string, unknown>;
  /** True nếu org vẫn active. Suspend = false. */
  active: boolean;
  /** Depth trong hierarchy. Root = 0. Hard cap 3. */
  depth: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationInput {
  name: string;
  slug: string;
  /** Inherit từ parent. Nếu null + parent = null → caller phải cung cấp. */
  plan?: string;
  settings?: Record<string, unknown>;
}

export interface OrganizationUpdate {
  name?: string;
  slug?: string;
  settings?: Record<string, unknown>;
  active?: boolean;
}

export interface OrganizationNode extends Organization {
  children: OrganizationNode[];
  path: string[]; // root → this
}

export const SUBORG_MAX_DEPTH = 3;
export const SUBORG_NAME_MAX_LENGTH = 200;
export const SUBORG_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
export const SUBORG_PLAN_QUOTAS: Record<string, { maxSubOrgs: number; maxDepth: number }> = {
  free: { maxSubOrgs: 0, maxDepth: 0 },
  pro: { maxSubOrgs: 3, maxDepth: 2 },
  enterprise: { maxSubOrgs: 50, maxDepth: 3 },
  internal: { maxSubOrgs: 1000, maxDepth: 5 },
};
