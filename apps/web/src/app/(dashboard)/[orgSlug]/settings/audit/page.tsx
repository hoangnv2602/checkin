import { AuditLogViewerPage } from "@/modules/audit/components/AuditLogViewerPage";

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <AuditLogViewerPage orgSlug={orgSlug} />;
}

export const dynamic = "force-dynamic";
