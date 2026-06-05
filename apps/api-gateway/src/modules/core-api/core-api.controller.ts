import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * Core-apiController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("core-api")
@Controller("core-api")
export class Core-apiController {
  @Get()
  ping() {
    return { module: "core-api", status: "stub", phase: 0 };
  }
}
