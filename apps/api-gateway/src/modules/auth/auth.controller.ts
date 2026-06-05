import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * AuthController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  @Get()
  ping() {
    return { module: "auth", status: "stub", phase: 0 };
  }
}
