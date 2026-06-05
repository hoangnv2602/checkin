/**
 * apps/web/src/app/(public)/e/[orgSlug]/register/page.tsx
 */
import { notFound } from "next/navigation";
import { RegisterFormPage } from "@/modules/registration";
import { getPublicEvent } from "@/modules/registration/services/registrationApi";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { orgSlug } = await params;
  const { eventId } = await searchParams;
  if (!eventId) notFound();
  let event;
  try {
    event = await getPublicEvent(orgSlug, eventId);
  } catch {
    notFound();
  }
  return <RegisterFormPage event={event} />;
}

export const dynamic = "force-dynamic";
