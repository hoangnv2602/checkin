import { PaymentMethodPage } from "@/modules/billing";

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <PaymentMethodPage orgSlug={orgSlug} />;
}

export const dynamic = "force-dynamic";
