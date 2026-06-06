/**
 * apps/web/src/modules/checkin/components/CheckinDashboardPage.tsx
 *
 * Server-rendered shell + client-side realtime subscriptions.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useRealtimeDashboard } from "../hooks/useRealtimeDashboard";
import type { EventStats, CheckInRecord } from "../types/checkin";
import { formatTimeAgo } from "@/lib/format";

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";

export function CheckinDashboardPage({
  orgSlug,
  eventId,
  token,
}: {
  orgSlug: string;
  eventId: string;
  token: string;
}) {
  const orgIdQuery = useQuery({
    queryKey: ["org-id", orgSlug],
    queryFn: async () => {
      const res = await fetch(`${BFF}/v1/identity/org-by-slug/${orgSlug}`);
      if (!res.ok) throw new Error("org not found");
      return (await res.json()) as { id: string };
    },
  });
  const organizationId = orgIdQuery.data?.id ?? "";

  const { data: stats } = useQuery<EventStats>({
    queryKey: ["event-stats", eventId],
    queryFn: async () => {
      const res = await fetch(`${BFF}/v1/checkin/stats/${eventId}?organizationId=${organizationId}`);
      if (!res.ok) throw new Error("stats not available");
      return res.json();
    },
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,  // safety net ngoài socket
  });

  const { data: recent } = useQuery<CheckInRecord[]>({
    queryKey: ["recent-records", eventId],
    queryFn: async () => {
      const res = await fetch(`${BFF}/v1/checkin/recent?organizationId=${organizationId}&eventId=${eventId}&take=20`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(organizationId),
  });

  const { connected, alerts, leaderboard } = useRealtimeDashboard({
    eventId,
    organizationId,
    token,
  });

  if (orgIdQuery.isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (orgIdQuery.error) return <p className="p-8 text-destructive">Failed to load organization</p>;
  if (!stats) return <p className="p-8 text-muted-foreground">No stats yet</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Live check-in</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-muted"}`}
            aria-hidden
          />
          {connected ? "Live" : "Reconnecting…"}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Checked in" value={stats.checkedIn} accent="text-success" />
        <StatCard label="Total registrations" value={stats.totalRegistrations} />
        <StatCard label="% complete" value={`${stats.checkInPercent.toFixed(1)}%`} />
        <StatCard label="Rejected" value={stats.rejected} accent="text-destructive" />
      </div>

      <section>
        <h2 className="text-lg font-medium text-foreground">Top gates</h2>
        {leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No scans yet</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {leaderboard.map((g) => (
              <li key={g.gateId} className="flex items-center justify-between rounded border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{g.gateName}</span>
                <span className="text-muted-foreground">{g.count} scans</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {alerts.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-foreground">Alerts</h2>
          <ul className="mt-2 space-y-1">
            {alerts.map((a, idx) => (
              <li
                key={`${a.recordId}-${idx}`}
                className={`rounded border px-3 py-2 text-sm ${
                  a.type === "rejected"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-warning/30 bg-warning/10 text-warning"
                }`}
              >
                <span className="font-medium uppercase">{a.type}</span> · {a.message} ·{" "}
                {formatTimeAgo(a.scannedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-foreground">Recent scans</h2>
        {recent && recent.length > 0 ? (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Time</th>
                <th>Gate</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 text-foreground">{formatTimeAgo(r.scannedAt)}</td>
                  <td className="text-muted-foreground">{r.gateId.slice(0, 6)}</td>
                  <td>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        r.status === "Success"
                          ? "bg-success/10 text-success"
                          : r.status === "Duplicate"
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{r.rejectReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No scans yet</p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
