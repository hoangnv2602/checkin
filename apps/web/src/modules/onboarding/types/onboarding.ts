/**
 * apps/web/src/modules/onboarding/types/onboarding.ts
 *
 * I-703 — Onboarding state types. Mirror BFF response shape in
 * `apps/api-gateway/src/modules/onboarding/onboarding.service.ts`.
 */
export const OnboardingStep = {
  ConfirmEmail: "confirm_email",
  CreateEvent: "create_event",
  AddStaff: "add_staff",
  Publish: "publish",
  Share: "share",
} as const;
export type OnboardingStepType = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export const ONBOARDING_STEPS: OnboardingStepType[] = [
  OnboardingStep.ConfirmEmail,
  OnboardingStep.CreateEvent,
  OnboardingStep.AddStaff,
  OnboardingStep.Publish,
  OnboardingStep.Share,
];

export interface OnboardingState {
  currentStep: OnboardingStepType;
  highestCompletedStep: OnboardingStepType | null;
  data: {
    eventId?: string;
    staffEmails?: string[];
    publishedAt?: string;
  };
  dismissed: boolean;
  updatedAt: string;
}
