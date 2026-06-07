import { AuditLogViewerPage } from "@/modules/audit/components/AuditLogViewerPage";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    actorUserId?: string;
    action?: string;
    from?: string;
    to?: string;
    skip?: string;
    take?: string;
  }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  return <AuditLogViewerPage orgSlug={orgSlug} searchParams={Promise.resolve(sp)} />;
}

export const dynamic = "force-dynamic";
