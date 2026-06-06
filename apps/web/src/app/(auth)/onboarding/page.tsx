/**
 * apps/web/src/app/(auth)/onboarding/page.tsx
 */
import { OnboardingWizard } from "@/modules/onboarding/components/OnboardingWizard";

export default function Page() {
  return <OnboardingWizard initialStep={1} />;
}
