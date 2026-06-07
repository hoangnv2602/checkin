/**
 * apps/web/src/modules/analytics/components/EventStatsPage.tsx
 *
 * /[orgSlug]/events/[eventId]/stats — analytics dashboard với cohort, no-show,
 * time-to-checkin, peak gate + time, CSV export.
 */
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { env } from "@/modules/_shared/config/env";

interface Report {
  eventId: string;
  totalRegistered: number;
  totalCheckedIn: number;
  noShowPercent: number;
  avgCheckInMinutes: number;
  p50CheckInMinutes: number;
  p95CheckInMinutes: number;
  peakGate: string;
  peakTime: string | null;
  cohorts: Array<{
    ticketTypeId: string;
    ticketTypeName: string;
    registered: number;
    attended: number;
    attendancePercent: number;
  }>;
}

export async function EventStatsPage({
  orgSlug,
  eventId,
}: {
  orgSlug: string;
  eventId: string;
}) {
  const session = await useAuth();
  const organizationId = session?.tenant?.id ?? "";

  const bff = env.bffUrl;
  const res = await fetch(
    `${bff}/v1/analytics/events/${eventId}/report`,
    {
      cache: "no-store",
      headers: organizationId ? { "X-Tenant-Id": organizationId } : {},
    },
  );
  if (!res.ok) {
    return <p className="p-8 text-destructive">Failed to load analytics</p>;
  }
  const report = (await res.json()) as Report;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Event analytics</h1>
        <a
          href={`/api/analytics/events/${eventId}/export`}
          className="rounded border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Export CSV
        </a>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total registered" value={report.totalRegistered.toLocaleString()} />
        <Stat label="Checked in" value={report.totalCheckedIn.toLocaleString()} accent="text-success" />
        <Stat label="No-show" value={`${report.noShowPercent.toFixed(1)}%`} accent="text-warning" />
        <Stat label="Peak gate" value={report.peakGate} />
      </div>

      <section>
        <h2 className="text-lg font-medium text-foreground">Time to check-in</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <Stat label="Avg" value={`${report.avgCheckInMinutes.toFixed(1)} min`} />
          <Stat label="p50" value={`${report.p50CheckInMinutes.toFixed(1)} min`} />
          <Stat label="p95" value={`${report.p95CheckInMinutes.toFixed(1)} min`} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-foreground">Cohort by ticket type</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Ticket type</th>
              <th>Registered</th>
              <th>Attended</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {report.cohorts.map((c) => (
              <tr key={c.ticketTypeName} className="border-t border-border">
                <td className="py-2 font-medium text-foreground">{c.ticketTypeName}</td>
                <td className="text-foreground">{c.registered}</td>
                <td className="text-foreground">{c.attended}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span>{c.attendancePercent.toFixed(1)}%</span>
                    <div className="h-2 w-24 overflow-hidden rounded bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${c.attendancePercent}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
