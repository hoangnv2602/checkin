/**
 * apps/web/src/modules/onboarding/services/onboardingApi.ts
 *
 * I-703 — Server actions wrapping the BFF onboarding endpoints. Use from
 * server components and server actions only (`import "server-only"`).
 */
import "server-only";
import { cookies } from "next/headers";
import { env } from "@/modules/_shared/config/env";
import type { OnboardingState, OnboardingStepType } from "../types/onboarding";

const BFF = env.bffUrl;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const res = await fetch(`${BFF}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`onboarding ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  return call<OnboardingState>("/v1/onboarding/state");
}

export async function advanceOnboarding(
  step: OnboardingStepType,
  data: OnboardingState["data"] = {},
): Promise<OnboardingState> {
  return call<OnboardingState>("/v1/onboarding/advance", {
    method: "POST",
    body: JSON.stringify({ step, data }),
  });
}

export async function skipOnboarding(): Promise<OnboardingState> {
  return call<OnboardingState>("/v1/onboarding/skip", { method: "POST" });
}

export async function resetOnboarding(): Promise<OnboardingState> {
  return call<OnboardingState>("/v1/onboarding/reset", { method: "POST" });
}
