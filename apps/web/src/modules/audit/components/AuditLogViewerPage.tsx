/**
 * apps/web/src/modules/audit/components/AuditLogViewerPage.tsx
 *
 * /[orgSlug]/settings/audit — Owner only. Audit log table với filters.
 */
import { headers } from "next/headers";
import { AuditLogFilters } from "./AuditLogFilters";

interface AuditEntry {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  ipAddress: string | null;
}

export async function AuditLogViewerPage({ orgSlug }: { orgSlug: string }) {
  const hdrs = await headers();
  const organizationId = hdrs.get("x-tenant-id") ?? "";
  const coreApi = process.env.CORE_API_BASE ?? "http://localhost:5050";
  const sp = new URLSearchParams({ organizationId, take: "100" });

  const actorUserId = hdrs.get("x-filter-actor") ?? "";
  const action = hdrs.get("x-filter-action") ?? "";
  if (actorUserId) sp.set("actorUserId", actorUserId);
  if (action) sp.set("action", action);

  const res = await fetch(`${coreApi}/v1/audit/log?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    return <p className="p-8 text-destructive">Failed to load audit log</p>;
  }
  const data = (await res.json()) as { entries: AuditEntry[]; total: number };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.total} entries</p>
      </header>

      <AuditLogFilters />

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2">When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((e) => (
            <tr key={e.id} className="border-t border-border">
              <td className="py-2 text-foreground">{new Date(e.occurredAt).toLocaleString()}</td>
              <td>
                <div className="text-foreground">{e.actorUserId.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{e.actorRole}</div>
              </td>
              <td>
                <code className="rounded bg-muted px-2 py-1 text-xs">{e.action}</code>
              </td>
              <td>
                <div className="text-foreground">{e.entityType}</div>
                <div className="font-mono text-xs text-muted-foreground">{e.entityId.slice(0, 12)}</div>
              </td>
              <td className="text-xs text-muted-foreground">{e.ipAddress ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
