import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";

/**
 * HealthController — liveness + readiness probe (K8s convention).
 * /health/live  → process sống (luôn 200)
 * /health/ready → check DB + Redis + gRPC tới core-api (Phase 1+)
 *
 * Cả 2 endpoints @Public() — K8s probe không cần auth.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  @Public()
  @Get("live")
  live() {
    return { status: "ok", service: "api-gateway", timestamp: new Date().toISOString() };
  }

  @Public()
  @Get("ready")
  ready() {
    // Phase 0: chỉ report service name. Phase 1+ check DB/Redis/grpc.
    return { status: "ready", service: "api-gateway", checks: {} };
  }
}
