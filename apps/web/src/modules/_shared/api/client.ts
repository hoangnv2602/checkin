/**
 * apps/web/src/modules/_shared/api/client.ts
 *
 * Server-side BFF client + Set-Cookie forwarder.
 * `import "server-only"` — KHÔNG được import từ client component.
 */
import "server-only";
import { env } from "../config/env";
import { AuthError } from "./errors";

export { AuthError };

type BffFetchOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  cookies?: string;
  redirect?: RequestRedirect;
};

export async function bffFetch<T>(
  path: string,
  opts: BffFetchOptions = {},
): Promise<T> {
  const res = await fetch(`${env.bffUrl}${path}`, {
    method: opts.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookies ? { cookie: opts.cookies } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: opts.redirect ?? "manual",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AuthError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

export function forwardCookies(
  res: Response,
  setCookie: (name: string, value: string, opts: Record<string, unknown>) => void,
): void {
  const list: string[] = res.headers.getSetCookie?.() ?? [];
  for (const raw of list) {
    const parts = raw.split(";").map((s) => s.trim());
    const pair = parts[0];
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);

    const opts: Record<string, unknown> = { path: "/" };
    for (const attr of parts.slice(1)) {
      const m = attr.match(/^([^=]+)(?:=(.*))?$/i);
      if (!m) continue;
      const k = m[1].toLowerCase();
      const v = m[2];
      if (k === "max-age" && v) opts.maxAge = parseInt(v, 10);
      else if (k === "expires" && v) opts.expires = new Date(v);
      else if (k === "httponly") opts.httpOnly = true;
      else if (k === "secure") opts.secure = true;
      else if (k === "samesite" && v) opts.sameSite = v.toLowerCase();
      else if (k === "path" && v) opts.path = v;
    }
    setCookie(name, decodeURIComponent(value), opts);
  }
}
