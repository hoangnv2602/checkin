/**
 * apps/web/src/modules/audit/components/AuditLogFilters.tsx
 *
 * Filters for /[orgSlug]/settings/audit. Pushes state to URL search params
 * so the page is shareable + back-button works.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuditLogFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [actor, setActor] = useState(params.get("actorUserId") ?? "");
  const [action, setAction] = useState(params.get("action") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  function applyFilters() {
    const sp = new URLSearchParams();
    if (actor) sp.set("actorUserId", actor);
    if (action) sp.set("action", action);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    router.push(`?${sp.toString()}`);
  }

  function resetFilters() {
    setActor("");
    setAction("");
    setFrom("");
    setTo("");
    router.push("?");
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-border bg-card p-4">
      <div>
        <label className="block text-xs text-muted-foreground">Actor user id</label>
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="mt-1 w-44 rounded border border-input bg-background px-3 py-1 text-sm text-foreground"
          placeholder="user-uuid"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">Action</label>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="mt-1 w-44 rounded border border-input bg-background px-3 py-1 text-sm text-foreground"
          placeholder="event.published"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="mt-1 rounded border border-input bg-background px-3 py-1 text-sm text-foreground"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 rounded border border-input bg-background px-3 py-1 text-sm text-foreground"
        />
      </div>
      <button
        onClick={applyFilters}
        className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
      >
        Apply
      </button>
      <button
        onClick={resetFilters}
        className="rounded border border-border bg-card px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
      >
        Reset
      </button>
    </div>
  );
}
