/**
 * apps/web/src/modules/onboarding/schemas/onboarding.schema.ts
 *
 * I-703 — Zod schema for the create-event form (step 2) + invite-staff
 * form (step 3) used inside the onboarding wizard.
 */
import { z } from "zod";

export const OnboardingEventFormSchema = z.object({
  name: z.string().min(2, "Name required").max(200),
  venue: z.string().min(2, "Venue required").max(200),
  startsAt: z.string().min(1, "Start date required"),
});

export type OnboardingEventFormValues = z.infer<typeof OnboardingEventFormSchema>;

export const OnboardingStaffFormSchema = z.object({
  emails: z
    .array(z.string().email("Invalid email"))
    .min(1, "Add at least one staff email")
    .max(20, "Max 20 staff at once"),
});

export type OnboardingStaffFormValues = z.infer<typeof OnboardingStaffFormSchema>;
