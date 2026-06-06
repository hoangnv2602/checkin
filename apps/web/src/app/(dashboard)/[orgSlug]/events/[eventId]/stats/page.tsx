import { EventStatsPage } from "@/modules/analytics/components/EventStatsPage";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; eventId: string }>;
}) {
  const { orgSlug, eventId } = await params;
  return <EventStatsPage orgSlug={orgSlug} eventId={eventId} />;
}

export const dynamic = "force-dynamic";
