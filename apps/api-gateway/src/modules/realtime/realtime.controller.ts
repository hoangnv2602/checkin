import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * RealtimeController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("realtime")
@Controller("realtime")
export class RealtimeController {
  @Get()
  ping() {
    return { module: "realtime", status: "stub", phase: 0 };
  }
}
