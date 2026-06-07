/**
 * apps/web/src/modules/audit/components/AuditLogViewerPage.tsx
 *
 * /[orgSlug]/settings/audit — Owner only. Audit log table với filters.
 * Filters (actorUserId, action, date range) are read from URL search params
 * so the URL is shareable + back-button works.
 */
import { cookies } from "next/headers";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { env } from "@/modules/_shared/config/env";
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

interface SearchParams {
  actorUserId?: string;
  action?: string;
  from?: string;
  to?: string;
  skip?: string;
  take?: string;
}

export async function AuditLogViewerPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Promise<SearchParams>;
}) {
  const session = await useAuth();
  const organizationId = session?.tenant?.id ?? "";
  const role = session?.tenant?.role;
  const sp = await searchParams;

  // Owner / Admin only — server-side check.
  if (role !== "Owner" && role !== "Admin") {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold text-foreground">Audit log</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is only available to organization owners and admins.
        </p>
      </div>
    );
  }

  if (!organizationId) {
    return <p className="p-8 text-destructive">No active organization</p>;
  }

  const params = new URLSearchParams({ take: sp.take ?? "100" });
  if (sp.actorUserId) params.set("actorUserId", sp.actorUserId);
  if (sp.action) params.set("action", sp.action);
  if (sp.from) params.set("from", sp.from);
  if (sp.to) params.set("to", sp.to);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sa_access_token")?.value ?? "";

  const bff = env.bffUrl;
  const res = await fetch(`${bff}/v1/audit/log?${params.toString()}`, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) {
    return <p className="p-8 text-destructive">Failed to load audit log</p>;
  }
  const data = (await res.json()) as { entries: AuditEntry[]; total: number };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.total.toLocaleString()} entries
        </p>
      </header>

      <AuditLogFilters />

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No entries match these filters
                </td>
              </tr>
            ) : (
              data.entries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">
                    {new Date(e.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-foreground">{e.actorUserId.slice(0, 8)}…</div>
                    <div className="text-xs text-muted-foreground">{e.actorRole}</div>
                  </td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">{e.action}</code>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{e.entityType}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {e.entityId.slice(0, 12)}…
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.ipAddress ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
