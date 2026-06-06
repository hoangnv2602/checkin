/**
 * apps/web/src/app/(public)/e/[orgSlug]/event/[eventSlug]/page.tsx
 *
 * /e/[orgSlug]/event/[eventSlug] — public SEO landing.
 * Server component delegates to EventLandingPage for data fetch.
 */
import { EventLandingPage } from "@/modules/registration";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  return <EventLandingPage orgSlug={orgSlug} eventSlugOrId={eventSlug} />;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Event — SaasCheckin" };
