/**
 * apps/web/src/modules/registration/components/PaySelectorPage.tsx
 *
 * /e/[slug]/register/pay — call core-api createOrder → BFF checkout → redirect.
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { DiscountQuote, Order, PaymentProviderName } from "../types/ticket";
import { formatMoney } from "@/lib/format";

interface CheckoutResponse {
  provider: PaymentProviderName;
  sessionId: string;
  redirectUrl: string;
  expiresAt: string;
}

export function PaySelectorPage({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventId = params.get("eventId") ?? "";
  const ticketTypeId = params.get("tt") ?? "";
  const quantity = Number(params.get("qty") ?? "1");
  const name = params.get("name") ?? "";
  const email = params.get("email") ?? "";
  const provider = (params.get("provider") as PaymentProviderName) ?? "stripe";
  const code = params.get("code") || undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // 1. create order qua BFF
        const createRes = await fetch("/api/register/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            ticketTypeId,
            quantity,
            buyerName: name,
            buyerEmail: email,
            discountCode: code,
            provider,
          }),
        });
        if (!createRes.ok) throw new Error(await createRes.text());
        const data = (await createRes.json()) as { order: Order; quote: DiscountQuote };
        if (cancelled) return;
        setOrder(data.order);
        setQuote(data.quote);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, ticketTypeId, quantity, name, email, code, provider]);

  async function onPay() {
    if (!order) return;
    setLoading(true);
    try {
      const res = await fetch("/api/register/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          organizationId: order.organizationId,
          provider: order.provider,
          amountMinor: order.total.amountMinor,
          currency: order.total.currency,
          buyerEmail: order.buyerEmail,
          buyerName: order.buyerName,
          description: `Order ${order.id}`,
          successUrl: `${window.location.origin}/e/${orgSlug}/register/success?orderId=${order.id}`,
          cancelUrl: `${window.location.origin}/e/${orgSlug}/register?eventId=${eventId}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const session = (await res.json()) as CheckoutResponse;
      window.location.href = session.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  if (loading) return <p className="p-8 text-muted-foreground">Preparing order…</p>;
  if (error) return <p className="p-8 text-destructive">Error: {error}</p>;
  if (!order || !quote) return null;

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded border border-border bg-card p-6">
      <h1 className="text-2xl font-semibold text-foreground">Confirm and pay</h1>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Quantity</dt>
          <dd className="font-medium text-foreground">{order.quantity}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium text-foreground">
            {formatMoney(order.subtotal.amountMinor, order.subtotal.currency)}
          </dd>
        </div>
        {order.discount.amountMinor > 0 && (
          <div className="flex justify-between text-success">
            <dt>Discount ({order.discountCode})</dt>
            <dd>−{formatMoney(order.discount.amountMinor, order.discount.currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="text-foreground">{formatMoney(order.total.amountMinor, order.total.currency)}</dd>
        </div>
      </dl>
      <button
        onClick={onPay}
        className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
      >
        Pay with {provider === "stripe" ? "Stripe" : "VNPay"}
      </button>
      <p className="text-xs text-muted-foreground">
        Order expires at {new Date(order.expiresAt).toLocaleTimeString()}. After that, your seat will be released.
      </p>
    </div>
  );
}
