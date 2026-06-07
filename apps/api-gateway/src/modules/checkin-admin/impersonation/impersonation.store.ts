/**
 * apps/api-gateway/src/modules/checkin-admin/impersonation/impersonation.store.ts
 *
 * I-906 — In-memory session store. Phase 10+ swap sang Postgres
 * `impersonation_sessions` (audit-grade retention 2 năm).
 */
import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  IMPERSONATION_SESSION_ID_PREFIX,
  type ImpersonationSession,
  type ImpersonationStartInput,
} from "./impersonation.types";

export interface IImpersonationStore {
  create(input: ImpersonationStartInput, expiresAt: Date): Promise<ImpersonationSession>;
  get(id: string): Promise<ImpersonationSession | null>;
  listActiveByPlatform(platformUserId: string): Promise<ImpersonationSession[]>;
  listByTenant(tenantId: string, limit: number): Promise<ImpersonationSession[]>;
  revoke(id: string, byPlatformUserId: string): Promise<ImpersonationSession | null>;
  /** Auto-expire sessions whose expiresAt < now. Returns số lượng expired. */
  sweep(now: Date): Promise<number>;
}

@Injectable()
export class InMemoryImpersonationStore implements IImpersonationStore {
  private readonly logger = new Logger(InMemoryImpersonationStore.name);
  private readonly sessions = new Map<string, ImpersonationSession>();

  private nextId(): string {
    return `${IMPERSONATION_SESSION_ID_PREFIX}${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  }

  async create(input: ImpersonationStartInput, expiresAt: Date): Promise<ImpersonationSession> {
    const now = new Date();
    // Risk R-20: revoke all previous active sessions for this platform user
    for (const s of this.sessions.values()) {
      if (s.platformUserId === input.platformUserId && s.state === "Active") {
        s.state = "Revoked";
        s.revokedAt = now.toISOString();
        s.revokedBy = "system:supersede";
        this.logger.warn(`auto-revoke previous session ${s.id} for platform user ${input.platformUserId}`);
      }
    }
    const session: ImpersonationSession = {
      id: this.nextId(),
      platformUserId: input.platformUserId,
      tenantId: input.tenantId,
      reason: input.reason,
      state: "Active",
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    this.sessions.set(session.id, session);
    this.logger.log(`impersonation start ${session.id} platform=${input.platformUserId} tenant=${input.tenantId} duration=${input.durationMinutes ?? 15}m`);
    return session;
  }

  async get(id: string): Promise<ImpersonationSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async listActiveByPlatform(platformUserId: string): Promise<ImpersonationSession[]> {
    return [...this.sessions.values()].filter(
      (s) => s.platformUserId === platformUserId && s.state === "Active",
    );
  }

  async listByTenant(tenantId: string, limit: number): Promise<ImpersonationSession[]> {
    return [...this.sessions.values()]
      .filter((s) => s.tenantId === tenantId)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .slice(0, limit);
  }

  async revoke(id: string, byPlatformUserId: string): Promise<ImpersonationSession | null> {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (s.state !== "Active") return s;
    s.state = "Revoked";
    s.revokedAt = new Date().toISOString();
    s.revokedBy = byPlatformUserId;
    this.logger.log(`impersonation revoke ${id} by=${byPlatformUserId}`);
    return s;
  }

  async sweep(now: Date): Promise<number> {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s.state === "Active" && new Date(s.expiresAt) < now) {
        s.state = "Expired";
        n += 1;
      }
    }
    if (n > 0) this.logger.log(`impersonation sweep expired=${n}`);
    return n;
  }
}
