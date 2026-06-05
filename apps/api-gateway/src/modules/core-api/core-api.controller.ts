import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";

/**
 * CoreApiController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("core-api")
@Controller("core-api")
export class CoreApiController {
  @Public()
  @Get()
  ping() {
    return { module: "core-api", status: "stub", phase: 0 };
  }
}
