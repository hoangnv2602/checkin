/**
 * apps/web/src/modules/onboarding/index.ts
 *
 * I-703 — Barrel re-exports. Public surface của feature module.
 */
export { OnboardingWizard } from "./components/OnboardingWizard";
export { OnboardingComplete } from "./components/OnboardingComplete";
export type {
  OnboardingState,
  OnboardingStepType,
} from "./types/onboarding";
export { OnboardingStep, ONBOARDING_STEPS } from "./types/onboarding";
