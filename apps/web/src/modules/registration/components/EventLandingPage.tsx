/**
 * apps/web/src/modules/registration/components/EventLandingPage.tsx
 *
 * Server-rendered landing page (I-303 /e/[slug]) — SEO critical.
 * Triggers: GET /v1/public/{orgSlug}/events/{eventIdOrSlug}.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicEvent } from "../services/registrationApi";
import { formatMoney } from "@/lib/format";

export async function EventLandingPage({
  orgSlug,
  eventSlugOrId,
}: {
  orgSlug: string;
  eventSlugOrId: string;
}) {
  let event;
  try {
    event = await getPublicEvent(orgSlug, eventSlugOrId);
  } catch {
    notFound();
  }
  if (event.status !== "published") notFound();

  const startsAt = new Date(event.startAt);
  const endsAt = new Date(event.endAt);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          {event.organizationName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">{event.title}</h1>
        <p className="mt-3 text-muted-foreground">
          {startsAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })} —{" "}
          {endsAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </header>

      {event.description && (
        <section className="prose prose-sm max-w-none text-foreground/80">
          <p>{event.description}</p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Tickets</h2>
        <ul className="mt-4 space-y-3">
          {event.ticketTypes.map((t) => {
            const remaining = t.capacity - t.soldCount;
            const soldOut = remaining <= 0;
            return (
              <li
                key={t.id}
                className="flex items-center justify-between rounded border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{t.name}</p>
                  {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {soldOut ? "Sold out" : `${remaining} remaining`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    {formatMoney(t.price.amountMinor, t.price.currency)}
                  </p>
                  {soldOut ? (
                    <span className="mt-1 inline-block text-xs text-muted-foreground">Unavailable</span>
                  ) : (
                    <Link
                      href={`/e/${orgSlug}/register?eventId=${event.id}&tt=${t.id}`}
                      className="mt-2 inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Register
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}
