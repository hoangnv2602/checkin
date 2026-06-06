/**
 * apps/web/src/modules/billing/components/BillingOverviewPage.tsx
 *
 * /[orgSlug]/billing — current plan, usage meter, upgrade CTA.
 */
import Link from "next/link";
import { getSubscription, getUsage, listPlans } from "../services/billingApi";
import { formatMoney } from "@/lib/format";

export async function BillingOverviewPage({ orgSlug }: { orgSlug: string }) {
  // Phase 3 stub: orgSlug -> orgId ở middleware thật (I-503 wiring)
  const organizationId = await resolveOrgId(orgSlug);
  if (!organizationId) return <p>Organization not found</p>;

  const [sub, usage, plans] = await Promise.all([
    getSubscription(organizationId),
    getUsage(organizationId),
    listPlans(),
  ]);

  const currentPlan = plans.find((p) => p.id === sub?.planId);
  const isTrial = sub?.state === "Trial";
  const trialEndsAt = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
      </header>

      {sub ? (
        <section className="rounded border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Current plan</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{currentPlan?.name ?? "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentPlan ? formatMoney(currentPlan.priceAmountMinor, currentPlan.priceCurrency) : ""} / {currentPlan?.period.toLowerCase()}
              </p>
            </div>
            <div className="text-right">
              {isTrial && trialEndsAt && (
                <p className="text-sm text-warning">Trial ends {trialEndsAt.toLocaleDateString()}</p>
              )}
              {!isTrial && (
                <p className="text-sm text-muted-foreground">
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">No active subscription</p>
          <Link
            href={`/${orgSlug}/billing/plans`}
            className="mt-3 inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Choose a plan
          </Link>
        </section>
      )}

      {usage && currentPlan && (
        <section>
          <h2 className="text-lg font-medium text-foreground">Usage this period</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <UsageBar label="Active events" current={usage.activeEvents} max={usage.maxActiveEvents} />
            <UsageBar label="Attendees / month" current={usage.attendeesThisMonth} max={usage.maxAttendeesPerMonth} />
            <UsageBar label="Staff seats" current={usage.staffSeats} max={usage.maxStaffSeats} />
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Available plans</h2>
          <Link href={`/${orgSlug}/billing/invoices`} className="text-sm text-primary hover:underline">
            View invoices →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={`rounded border p-4 ${p.id === currentPlan?.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <p className="font-semibold text-foreground">{p.name}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatMoney(p.priceAmountMinor, p.priceCurrency)}
              </p>
              <p className="text-xs text-muted-foreground">per {p.period.toLowerCase()}</p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>{p.maxActiveEvents} active events</li>
                <li>{p.maxAttendeesPerMonth.toLocaleString()} attendees / month</li>
                <li>{p.maxStaffSeats} staff seats</li>
              </ul>
              {p.id === currentPlan?.id ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">Current plan</p>
              ) : (
                <Link
                  href={`/${orgSlug}/billing/plans?upgrade=${p.id}`}
                  className="mt-3 block rounded bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground"
                >
                  {Number(p.tier) > Number(currentPlan?.tier ?? 0) ? "Upgrade" : "Switch"}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isNearLimit = pct >= 80;
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{current} / {max}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
        <div
          className={`h-full ${isNearLimit ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

async function resolveOrgId(slug: string): Promise<string | null> {
  // Phase 3 stub. Real impl: query BFF /v1/identity/org-by-slug/{slug}
  return "00000000-0000-0000-0000-000000000001";
}
