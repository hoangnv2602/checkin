/**
 * apps/api-gateway/src/modules/checkin-admin/impersonation/impersonation.service.ts
 *
 * I-906 — Service: start/revoke/list sessions + issue impersonation JWT claims.
 *
 * R-20 guardrails enforced here:
 *  - Reason ≥ 10 chars
 *  - Duration 1..30 min
 *  - Single active session per platform user (supersede revoke)
 *  - 15 min default
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InMemoryImpersonationStore } from "./impersonation.store";
import {
  IMPERSONATION_DEFAULT_DURATION_MINUTES,
  IMPERSONATION_MAX_DURATION_MINUTES,
  IMPERSONATION_REASON_MAX_LENGTH,
  IMPERSONATION_REASON_MIN_LENGTH,
  type ImpersonationClaims,
  type ImpersonationSession,
  type ImpersonationStartInput,
} from "./impersonation.types";

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);

  // Inject the concrete InMemoryImpersonationStore class (not the
  // IImpersonationStore interface) so Nest's runtime DI can resolve the
  // token via reflect-metadata. Interfaces are erased at compile time, so
  // declaring `private readonly store: IImpersonationStore` would surface
  // as `Object` to the injector and fail with UnknownDependenciesException.
  // The interface stays in impersonation.store.ts for documentation and
  // test-mock purposes; the concrete class is what's actually on the wire.
  constructor(private readonly store: InMemoryImpersonationStore) {}

  /**
   * Start a new impersonation session.
   * Auto-revokes any existing active session for the same platform user (R-20).
   */
  async start(input: ImpersonationStartInput): Promise<ImpersonationSession> {
    // Validate reason
    if (!input.reason || input.reason.length < IMPERSONATION_REASON_MIN_LENGTH) {
      throw new BadRequestException(`reason min ${IMPERSONATION_REASON_MIN_LENGTH} chars`);
    }
    if (input.reason.length > IMPERSONATION_REASON_MAX_LENGTH) {
      throw new BadRequestException(`reason max ${IMPERSONATION_REASON_MAX_LENGTH} chars`);
    }
    // Validate duration
    const duration = Math.min(
      Math.max(input.durationMinutes ?? IMPERSONATION_DEFAULT_DURATION_MINUTES, 1),
      IMPERSONATION_MAX_DURATION_MINUTES,
    );
    if (input.durationMinutes !== undefined && input.durationMinutes > IMPERSONATION_MAX_DURATION_MINUTES) {
      throw new ForbiddenException(`duration max ${IMPERSONATION_MAX_DURATION_MINUTES} minutes`);
    }
    if (!input.tenantId || !input.platformUserId) {
      throw new BadRequestException("platformUserId and tenantId required");
    }

    const expiresAt = new Date(Date.now() + duration * 60_000);
    return this.store.create({ ...input, durationMinutes: duration }, expiresAt);
  }

  async revoke(id: string, byPlatformUserId: string): Promise<ImpersonationSession> {
    const existing = await this.store.get(id);
    if (!existing) throw new NotFoundException("session not found");
    if (existing.state !== "Active") {
      throw new BadRequestException(`session already ${existing.state.toLowerCase()}`);
    }
    const s = await this.store.revoke(id, byPlatformUserId);
    if (!s) throw new NotFoundException("session not found");
    return s;
  }

  /**
   * Build JWT claims cho impersonation session. Subject = tenant user placeholder
   * (Phase 10 sẽ lookup user theo tenant); ở Phase 9 caller pass `sub`.
   */
  buildClaims(session: ImpersonationSession, subject: string): ImpersonationClaims {
    if (session.state !== "Active") {
      throw new ForbiddenException("session is not active");
    }
    const expSec = Math.floor(new Date(session.expiresAt).getTime() / 1000);
    const iatSec = Math.floor(new Date(session.startedAt).getTime() / 1000);
    return {
      sub: subject,
      tenantId: session.tenantId,
      is_impersonated: true,
      impersonation_session_id: session.id,
      impersonated_by: session.platformUserId,
      exp: expSec,
      iat: iatSec,
    };
  }

  async get(id: string): Promise<ImpersonationSession> {
    const s = await this.store.get(id);
    if (!s) throw new NotFoundException("session not found");
    return s;
  }

  async listActive(platformUserId: string): Promise<ImpersonationSession[]> {
    return this.store.listActiveByPlatform(platformUserId);
  }

  async listForTenant(tenantId: string, limit = 50): Promise<ImpersonationSession[]> {
    return this.store.listByTenant(tenantId, limit);
  }

  /** Periodic sweep — call from cron / health check interval. */
  async sweep(): Promise<number> {
    return this.store.sweep(new Date());
  }
}

export const _Store = InMemoryImpersonationStore;
