import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";

/**
 * JobsController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  @Public()
  @Get()
  ping() {
    return { module: "jobs", status: "stub", phase: 0 };
  }
}
