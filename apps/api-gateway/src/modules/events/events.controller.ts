import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * EventsController — Phase 0 stub.
 * Logic đầy đủ implement ở Phase tương ứng.
 */
@ApiTags("events")
@Controller("events")
export class EventsController {
  @Get()
  ping() {
    return { module: "events", status: "stub", phase: 0 };
  }
}
