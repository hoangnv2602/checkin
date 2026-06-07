/**
 * apps/api-gateway/src/modules/audit/audit.module.ts
 *
 * I-602 — Wires AuditController + AuditService.
 */
import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
