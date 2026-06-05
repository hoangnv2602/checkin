/**
 * apps/web/src/modules/registration/schemas/registration.schema.ts
 *
 * Zod schemas cho form validation (react-hook-form + zod resolver).
 */
import { z } from "zod";

export const RegisterFormSchema = z.object({
  ticketTypeId: z.string().uuid("Select a ticket type"),
  quantity: z.coerce.number().int().min(1, "Min 1").max(10, "Max 10 per order"),
  buyerName: z.string().min(2, "Name required").max(200),
  buyerEmail: z.string().email("Invalid email"),
  discountCode: z.string().max(50).optional().or(z.literal("")),
  provider: z.enum(["stripe", "vnpay"]),
});

export type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export const OtpFormSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "Digits only"),
});

export type OtpFormValues = z.infer<typeof OtpFormSchema>;
