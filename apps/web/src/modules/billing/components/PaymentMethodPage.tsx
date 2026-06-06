/**
 * apps/web/src/modules/billing/components/PaymentMethodPage.tsx
 *
 * /[orgSlug]/billing/payment-method — manage payment methods.
 * For Stripe: redirect to Customer Portal.
 * For VNPay: link to bank management UI.
 */
import { cookies } from "next/headers";

export async function PaymentMethodPage({ orgSlug }: { orgSlug: string }) {
  const store = await cookies();
  const orgId = store.get("sa_org_id")?.value ?? "";

  // Phase 5 stub — Phase 6 sẽ wire Stripe Customer Portal session + return URL
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Payment method</h1>
      <p className="text-sm text-muted-foreground">
        Manage your card or bank account. Phase 5 ships Stripe Customer Portal redirect;
        VNPay UI link to follow.
      </p>
      <a
        href={`/api/billing/portal?orgId=${orgId}`}
        className="inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Open Stripe Customer Portal
      </a>
    </div>
  );
}
