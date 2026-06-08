/**
 * apps/api-gateway/src/modules/sub-org/sub-org.module.ts
 *
 * I-905 — Module composition: SubOrgService + InMemorySubOrgStore.
 *
 * Phase 9 ships without a controller (service is consumed by integration tests
 * and Phase 10 migration to Postgres will introduce the HTTP surface). The
 * module exists so the providers are registered with Nest and any future
 * controller can `imports: [SubOrgModule]`.
 */
import { Module } from "@nestjs/common";
import { InMemorySubOrgStore } from "./sub-org.store";
import { SubOrgService } from "./sub-org.service";

@Module({
  providers: [InMemorySubOrgStore, SubOrgService],
  exports: [SubOrgService, InMemorySubOrgStore],
})
export class SubOrgModule {}
