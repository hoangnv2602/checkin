/**
 * apps/web/src/modules/onboarding/hooks/useOnboarding.ts
 *
 * I-703 — Client-side state machine hook. Wraps server actions (advance/skip/reset)
 * and exposes a `useTransition` for UX. Re-fetches state after each mutation.
 */
"use client";

import { useCallback, useState, useTransition } from "react";
import {
  advanceOnboarding,
  resetOnboarding,
  skipOnboarding,
} from "../services/onboardingApi";
import type { OnboardingState, OnboardingStepType } from "../types/onboarding";

export function useOnboarding(initialState: OnboardingState) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const advance = useCallback(
    (step: OnboardingStepType, data: OnboardingState["data"] = {}) => {
      startTransition(async () => {
        try {
          setError(null);
          const next = await advanceOnboarding(step, data);
          setState(next);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    },
    [],
  );

  const skip = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        const next = await skipOnboarding();
        setState(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  const reset = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        const next = await resetOnboarding();
        setState(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return { state, advance, skip, reset, isPending, error };
}
