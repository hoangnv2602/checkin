import { BillingOverviewPage } from "@/modules/billing";

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <BillingOverviewPage orgSlug={orgSlug} />;
}

export const dynamic = "force-dynamic";
