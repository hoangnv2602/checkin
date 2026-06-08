/**
 * apps/api-gateway/src/modules/checkin-admin/impersonation/impersonation.module.ts
 *
 * I-906 — Module composition: ImpersonationService + InMemoryImpersonationStore.
 *
 * Phase 9 ships without a controller (service is consumed by integration tests
 * and Phase 10 migration to Postgres will introduce the HTTP surface). The
 * module exists so the providers are registered with Nest and any future
 * controller can `imports: [ImpersonationModule]`.
 */
import { Module } from "@nestjs/common";
import { InMemoryImpersonationStore } from "./impersonation.store";
import { ImpersonationService } from "./impersonation.service";

@Module({
  providers: [InMemoryImpersonationStore, ImpersonationService],
  exports: [ImpersonationService, InMemoryImpersonationStore],
})
export class ImpersonationModule {}
