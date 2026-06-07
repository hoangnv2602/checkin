/**
 * apps/web/src/app/(auth)/onboarding/page.tsx
 *
 * I-703 — Server component fetches current onboarding state from BFF and
 * passes to client wizard. If user has skipped wizard, redirect to dashboard.
 * If wizard is complete, show success panel.
 */
import { redirect } from "next/navigation";
import { getOnboardingState } from "@/modules/onboarding/services/onboardingApi";
import { OnboardingWizard } from "@/modules/onboarding/components/OnboardingWizard";
import { OnboardingComplete } from "@/modules/onboarding/components/OnboardingComplete";
import { ONBOARDING_STEPS } from "@/modules/onboarding/types/onboarding";

export default async function Page() {
  const state = await getOnboardingState().catch(() => null);
  if (!state) {
    return <OnboardingWizard initialState={null} />;
  }
  if (state.dismissed) {
    redirect("/dashboard");
  }

  const isComplete = state.highestCompletedStep === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
  if (isComplete) {
    return <OnboardingComplete />;
  }

  return <OnboardingWizard initialState={state} />;
}
