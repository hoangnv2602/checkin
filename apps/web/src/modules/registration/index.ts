/**
 * apps/web/src/modules/registration/index.ts — barrel exports.
 */
export { EventLandingPage } from "./components/EventLandingPage";
export { RegisterFormPage } from "./components/RegisterFormPage";
export { PaySelectorPage } from "./components/PaySelectorPage";
export { RegisterSuccessPage } from "./components/RegisterSuccessPage";
export { TicketOtpGatePage } from "./components/TicketOtpGatePage";
export * from "./types/ticket";
export * from "./schemas/registration.schema";
export * as registrationApi from "./services/registrationApi";
