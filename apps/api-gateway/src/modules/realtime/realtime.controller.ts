import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";

/**
 * RealtimeController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("realtime")
@Controller("realtime")
export class RealtimeController {
  @Public()
  @Get()
  ping() {
    return { module: "realtime", status: "stub", phase: 0 };
  }
}
