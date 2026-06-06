import { InvoicesPage } from "@/modules/billing";

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <InvoicesPage orgSlug={orgSlug} />;
}

export const dynamic = "force-dynamic";
