/**
 * apps/web/src/modules/billing/services/billingApi.ts
 */
import "server-only";
import { env } from "@/modules/_shared/config/env";
import { forwardCookies } from "@/modules/_shared/api";
import { cookies } from "next/headers";
import type { Invoice, Plan, Subscription, UsageMeter } from "../types/billing";

const BFF = env.bffUrl;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const store = await cookies();
  const cookieHeader = store.get("sa_access_token")?.value
    ? `sa_access_token=${store.get("sa_access_token")!.value}`
    : "";
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
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  forwardCookies(res, (name, value, opts) => {
    store.set(name, value, opts as Parameters<typeof store.set>[2]);
  });
  return (await res.json()) as T;
}

export async function listPlans(): Promise<Plan[]> {
  return call<Plan[]>("/v1/billing/plans");
}

export async function getSubscription(organizationId: string): Promise<Subscription | null> {
  try {
    return await call<Subscription>(`/v1/billing/subscriptions/current?organizationId=${organizationId}`);
  } catch {
    return null;
  }
}

export async function getUsage(organizationId: string): Promise<UsageMeter> {
  return call<UsageMeter>(`/v1/billing/usage?organizationId=${organizationId}`);
}

export async function listInvoices(organizationId: string, skip = 0, take = 20): Promise<Invoice[]> {
  return call<Invoice[]>(`/v1/billing/invoices?organizationId=${organizationId}&skip=${skip}&take=${take}`);
}

export async function subscribeToPlan(input: { organizationId: string; planId: string; startTrial: boolean }) {
  return call<Subscription>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelSubscription(organizationId: string) {
  return call<void>("/v1/billing/subscriptions/cancel", {
    method: "POST",
    body: JSON.stringify({ organizationId }),
  });
}
