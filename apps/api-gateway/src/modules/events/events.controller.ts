/**
 * apps/api-gateway/src/modules/events/events.controller.ts — I-202
 *
 * REST endpoints cho Events + Venues. Tất cả require authenticated user
 * (JwtAuthGuard global). `organizationId` lấy từ JWT claim (`VerifiedAuth.tenantId`)
 * — KHÔNG trust client header. Forward sang core-api qua EventsService
 * (gRPC bridge qua grpc-core-client).
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
import { CreateVenueDto, ListVenuesQueryDto } from "./dto/venues.dto";
import { EventsService, type EventDto, type VenueDto, type SessionDto } from "./events.service";

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

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Transition event Published → Completed" })
  async complete(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<EventDto> {
    return this.events.complete(this.orgIdOrThrow(user), id);
  }

  // ============ SESSIONS ============

  @Get(":id/sessions")
  @ApiOperation({ summary: "List sessions for an event" })
  async listSessions(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("skip") skip = 0,
    @Query("take") take = 50,
  ): Promise<SessionDto[]> {
    return this.events.listSessions(this.orgIdOrThrow(user), id, Number(skip), Number(take));
  }

  @Post(":id/sessions")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a session to an event" })
  async addSession(
    @CurrentUser() user: VerifiedAuth,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: { title: string; description?: string; startAt: string; endAt: string; capacity: number; venueId?: string },
  ): Promise<SessionDto> {
    return this.events.addSession(this.orgIdOrThrow(user), id, dto);
  }

  private orgIdOrThrow(user: VerifiedAuth | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException("Missing tenant claim in JWT");
    }
    return user.tenantId;
  }
}

@ApiTags("venues")
@Controller("v1/venues")
export class VenuesController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: "List venues in current organization" })
  async list(
    @CurrentUser() user: VerifiedAuth,
    @Query() query: ListVenuesQueryDto,
  ): Promise<VenueDto[]> {
    return this.events.listVenues(this.orgIdOrThrow(user), {
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new venue" })
  async create(
    @CurrentUser() user: VerifiedAuth,
    @Body() dto: CreateVenueDto,
  ): Promise<VenueDto> {
    return this.events.addVenue(this.orgIdOrThrow(user), dto);
  }

  private orgIdOrThrow(user: VerifiedAuth | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException("Missing tenant claim in JWT");
    }
    return user.tenantId;
  }
}
