/**
 * apps/web/src/modules/audit/components/AuditLogFilters.tsx
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuditLogFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [actor, setActor] = useState(params.get("actorUserId") ?? "");
  const [action, setAction] = useState(params.get("action") ?? "");

  function applyFilters() {
    const sp = new URLSearchParams();
    if (actor) sp.set("actorUserId", actor);
    if (action) sp.set("action", action);
    router.push(`?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-border bg-card p-4">
      <div>
        <label className="block text-xs text-muted-foreground">Actor user id</label>
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="mt-1 rounded border border-input bg-background px-3 py-1 text-sm text-foreground"
          placeholder="user-uuid"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">Action</label>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="mt-1 rounded border border-input bg-background px-3 py-1 text-sm text-foreground"
          placeholder="event.published"
        />
      </div>
      <button
        onClick={applyFilters}
        className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
      >
        Apply
      </button>
    </div>
  );
}
