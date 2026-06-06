import { Module } from "@nestjs/common";
import { CoreApiModule } from "../core-api/core-api.module";
import { RegistrationController, PublicEventController } from "./registration.controller";
import { RegistrationService } from "./registration.service";

/**
 * RegistrationModule — I-303 (BFF → gRPC TicketingService).
 *
 * Public REST endpoints:
 *  - /v1/registration/ticket-types
 *  - /v1/registration/apply-discount
 *  - /v1/registration/orders
 *  - /v1/registration/orders/:orderId
 *  - /v1/registration/registrations/:registrationId
 *  - /v1/public/:orgSlug/events/:eventId
 *
 * Internally calls core-api TicketingService qua gRPC (port 50051).
 */
@Module({
  imports: [CoreApiModule],
  controllers: [RegistrationController, PublicEventController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
