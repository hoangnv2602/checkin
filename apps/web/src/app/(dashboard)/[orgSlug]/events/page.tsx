import { EventsPage } from "@/modules/events";

interface PageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function EventsListPage({ params }: PageProps) {
  const { orgSlug } = await params;
  return <EventsPage orgSlug={orgSlug} />;
}
