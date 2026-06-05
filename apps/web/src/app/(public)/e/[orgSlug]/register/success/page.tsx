/**
 * apps/web/src/app/(public)/e/[orgSlug]/register/success/page.tsx
 */
import { RegisterSuccessPage } from "@/modules/registration";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return <RegisterSuccessPage orgSlug={orgSlug} />;
}
