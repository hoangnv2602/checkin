/**
 * apps/api-gateway/src/modules/registration/registration.controller.ts — I-303
 *
 * Public REST endpoints cho attendee registration flow (no auth required).
 *  - GET    /v1/registration/ticket-types
 *  - POST   /v1/registration/apply-discount
 *  - POST   /v1/registration/orders
 *  - GET    /v1/registration/orders/:orderId
 *  - GET    /v1/registration/registrations/:registrationId
 *  - GET    /v1/public/:orgSlug/events/:eventId
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RegistrationService, type DiscountQuoteDto, type OrderDto, type RegistrationDto, type TicketTypeDto } from "./registration.service";
import { CoreApiService } from "../core-api/core-api.service";

@ApiTags("registration")
@Controller("v1/registration")
export class RegistrationController {
  constructor(
    private readonly reg: RegistrationService,
    private readonly core: CoreApiService,
  ) {}

  @Public()
  @Get("ticket-types")
  @ApiOperation({ summary: "List ticket types for an event" })
  async listTicketTypes(
    @Query("organizationId") organizationId: string,
    @Query("eventId") eventId: string,
  ): Promise<TicketTypeDto[]> {
    return this.reg.listTicketTypes(organizationId, eventId);
  }

  @Public()
  @Post("apply-discount")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Apply a discount code; return pricing quote" })
  async applyDiscount(@Body() body: {
    organizationId: string;
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    discountCode: string;
  }): Promise<DiscountQuoteDto> {
    return this.reg.applyDiscount(body);
  }

  @Public()
  @Post("orders")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create pending order; reserve seat" })
  async createOrder(@Body() body: {
    organizationId: string;
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    buyerEmail: string;
    buyerName: string;
    discountCode?: string;
    provider: "stripe" | "vnpay";
  }): Promise<OrderDto> {
    return this.reg.createOrder(body);
  }

  @Public()
  @Get("orders/:orderId")
  @ApiOperation({ summary: "Get order detail (after payment or for status page)" })
  async getOrder(
    @Param("orderId") orderId: string,
    @Query("organizationId") organizationId: string,
  ): Promise<OrderDto> {
    return this.reg.getOrder(orderId, organizationId);
  }

  @Public()
  @Get("registrations/:registrationId")
  @ApiOperation({ summary: "Get registration (requires OTP gate at app level)" })
  async getRegistration(
    @Param("registrationId") registrationId: string,
    @Query("organizationId") organizationId: string,
  ): Promise<RegistrationDto | null> {
    return this.reg.getRegistration(registrationId, organizationId);
  }
}

@ApiTags("public")
@Controller("v1/public")
export class PublicEventController {
  constructor(private readonly core: CoreApiService) {}

  @Public()
  @Get(":orgSlug/events/:eventId")
  @ApiOperation({ summary: "Public event landing detail" })
  async getPublicEvent(
    @Param("orgSlug") _orgSlug: string,
    @Param("eventId") eventId: string,
  ): Promise<unknown> {
    return this.core.getPublicEvent(eventId);
  }
}
