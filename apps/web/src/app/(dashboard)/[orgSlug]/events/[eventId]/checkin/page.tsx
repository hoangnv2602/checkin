/**
 * apps/web/src/app/(dashboard)/[orgSlug]/events/[eventId]/checkin/page.tsx
 *
 * /[orgSlug]/events/[eventId]/checkin — server shell, delegates to
 * CheckinDashboardPage for client realtime subscription.
 */
import { CheckinDashboardPage } from "@/modules/checkin/components/CheckinDashboardPage";
import { cookies } from "next/headers";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; eventId: string }>;
}) {
  const { orgSlug, eventId } = await params;
  const store = await cookies();
  const token = store.get("sa_access_token")?.value ?? "";
  return <CheckinDashboardPage orgSlug={orgSlug} eventId={eventId} token={token} />;
}

export const dynamic = "force-dynamic";
