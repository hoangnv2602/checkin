import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * HealthController — liveness + readiness probe (K8s convention).
 * /health/live  → process sống (luôn 200)
 * /health/ready → check DB + Redis + gRPC tới core-api (Phase 1+)
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get("live")
  live() {
    return { status: "ok", service: "api-gateway", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  ready() {
    // Phase 0: chỉ report service name. Phase 1+ check DB/Redis/grpc.
    return { status: "ready", service: "api-gateway", checks: {} };
  }
}
