import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * JobsController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  @Get()
  ping() {
    return { module: "jobs", status: "stub", phase: 0 };
  }
}
