/**
 * apps/web/src/app/ticket/[regId]/page.tsx — OTP gate for attendee QR.
 */
import { TicketOtpGatePage } from "@/modules/registration";

export default async function Page({
  params,
}: {
  params: Promise<{ regId: string }>;
}) {
  const { regId } = await params;
  return <TicketOtpGatePage registrationId={regId} />;
}
