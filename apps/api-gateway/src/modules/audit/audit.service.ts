/**
 * apps/api-gateway/src/modules/audit/audit.service.ts
 *
 * I-602 — BFF bridge to core-api audit_log read-only query.
 * Used by the Owner audit viewer at /[orgSlug]/settings/audit.
 */
import { Injectable } from "@nestjs/common";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

export interface AuditLogEntryDto {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  ipAddress: string | null;
}

export interface AuditLogPageDto {
  entries: AuditLogEntryDto[];
  total: number;
}

export interface ListAuditLogParams {
  organizationId: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class AuditService {
  async list(params: ListAuditLogParams): Promise<AuditLogPageDto> {
    const q = new URLSearchParams();
    q.set("organizationId", params.organizationId);
    if (params.actorUserId) q.set("actorUserId", params.actorUserId);
    if (params.action) q.set("action", params.action);
    if (params.entityType) q.set("entityType", params.entityType);
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    q.set("skip", String(params.skip ?? 0));
    q.set("take", String(params.take ?? 50));

    const url = `${CORE_API_BASE}/v1/audit/log?${q.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`core-api audit list failed: ${res.status}`);
    return res.json() as Promise<AuditLogPageDto>;
  }
}
