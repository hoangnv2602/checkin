/**
 * apps/api-gateway/src/modules/events/events.controller.ts — I-202
 *
 * REST endpoints cho Events. Tất cả require authenticated user (JwtAuthGuard
 * global). `organizationId` lấy từ JWT claim (`VerifiedAuth.tenantId`) — KHÔNG
 * trust client header. Forward sang core-api qua EventsService (REST bridge —
 * Phase 2 chưa có gRPC contract ổn định, I-202b sẽ chuyển sang gRPC).
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { VerifiedAuth } from "../auth/services/jwt-verifier.service";
import { CreateEventDto, ListEventsQueryDto, UpdateEventDto } from "./dto/events.dto";
import { EventsService, type EventDto } from "./events.service";

@ApiTags("events")
@Controller("v1/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: "List events in current organization" })
  async list(
    @CurrentUser() user: VerifiedAuth,
    @Query() query: ListEventsQueryDto,
  ): Promise<EventDto[]> {
    return this.events.list(this.orgIdOrThrow(user), {
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get event by id (cached 5 min)" })
  async findOne(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<EventDto> {
    return this.events.findOne(this.orgIdOrThrow(user), id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new draft event" })
  async create(
    @CurrentUser() user: VerifiedAuth,
    @Body() dto: CreateEventDto,
  ): Promise<EventDto> {
    return this.events.create(this.orgIdOrThrow(user), dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a draft event" })
  async update(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventDto> {
    return this.events.update(this.orgIdOrThrow(user), id, dto);
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Transition event Draft → Published" })
  async publish(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<EventDto> {
    return this.events.publish(this.orgIdOrThrow(user), id);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a published event" })
  async cancel(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<EventDto> {
    return this.events.cancel(this.orgIdOrThrow(user), id);
  }

  /**
   * Web audience JWT luôn có tenantId claim. Nếu thiếu → từ chối (defensive —
   * mọi endpoint trong module này đều tenant-scoped).
   */
  private orgIdOrThrow(user: VerifiedAuth | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException("Missing tenant claim in JWT");
    }
    return user.tenantId;
  }
}
