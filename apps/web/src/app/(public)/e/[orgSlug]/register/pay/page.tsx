/**
 * apps/web/src/app/(public)/e/[orgSlug]/register/pay/page.tsx
 */
import { PaySelectorPage } from "@/modules/registration";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return <PaySelectorPage orgSlug={orgSlug} />;
}

export const dynamic = "force-dynamic";
