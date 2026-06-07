/**
 * apps/web/src/modules/onboarding/components/OnboardingComplete.tsx
 *
 * I-703 — Shown when user reaches the final step (Share). Replaces wizard
 * with a "all set" panel + CTA to dashboard.
 */
import Link from "next/link";

export function OnboardingComplete() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
      <div className="text-4xl">🎉</div>
      <h1 className="text-2xl font-semibold text-foreground">Setup complete</h1>
      <p className="text-sm text-muted-foreground">
        Your event is published and your staff are invited. Head to the dashboard to see live
        check-in stats.
      </p>
      <Link
        href="/dashboard"
        className="inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
