/**
 * apps/web/src/modules/events/services/eventsApi.ts
 *
 * Server-side fetch wrapper. Forwards cookies để BFF verify JWT.
 */
import "server-only";
import { cookies } from "next/headers";
import { env } from "@/modules/_shared/config/env";
import { AuthError } from "@/modules/_shared/api/errors";
import { forwardCookies } from "@/modules/_shared/api";
import type { Event } from "../types/event";

const BFF = env.bffUrl;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const store = await cookies();
  const cookieHeader = Object.entries({
    sa_access_token: store.get("sa_access_token")?.value,
  })
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await fetch(`${BFF}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.headers ?? {}),
    },
    redirect: "manual",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AuthError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  forwardCookies(res, (name, value, opts) => {
    store.set(name, value, opts as Parameters<typeof store.set>[2]);
  });
  return (await res.json()) as T;
}

export async function listEvents(params: { status?: string; skip?: number; take?: number }): Promise<Event[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  qs.set("skip", String(params.skip ?? 0));
  qs.set("take", String(params.take ?? 20));
  return call<Event[]>(`/v1/events?${qs.toString()}`);
}

export async function getEvent(id: string): Promise<Event> {
  return call<Event>(`/v1/events/${id}`);
}

export async function createEvent(input: unknown): Promise<Event> {
  return call<Event>("/v1/events", { method: "POST", body: JSON.stringify(input) });
}

export async function updateEvent(id: string, input: unknown): Promise<Event> {
  return call<Event>(`/v1/events/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function publishEvent(id: string): Promise<Event> {
  return call<Event>(`/v1/events/${id}/publish`, { method: "POST" });
}

export async function cancelEvent(id: string): Promise<Event> {
  return call<Event>(`/v1/events/${id}/cancel`, { method: "POST" });
}

export async function completeEvent(id: string): Promise<Event> {
  return call<Event>(`/v1/events/${id}/complete`, { method: "POST" });
}
