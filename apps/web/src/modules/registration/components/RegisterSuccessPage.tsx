/**
 * apps/web/src/modules/registration/components/RegisterSuccessPage.tsx
 *
 * /e/[slug]/register/success — trang xác nhận, đợi webhook sync trạng thái.
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Order } from "../types/ticket";

export function RegisterSuccessPage({ orgSlug }: { orgSlug: string }) {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/register/order/${orderId}`);
        if (res.ok) {
          const o = (await res.json()) as Order;
          if (cancelled) return;
          setOrder(o);
          if (o.status === "Paid" || o.status === "Failed") return;
        }
      } catch {
        // ignore — continue polling
      }
      if (cancelled) return;
      setPollCount((n) => n + 1);
      if (pollCount < 30) setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [orderId, pollCount]);

  return (
    <div className="mx-auto max-w-xl rounded border border-border bg-card p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Thank you!</h1>
      <p className="mt-2 text-muted-foreground">
        Order ID: <code className="rounded bg-muted px-2 py-1 text-xs">{orderId}</code>
      </p>
      {!order && <p className="mt-4 text-sm text-muted-foreground">Loading order details…</p>}
      {order?.status === "Paid" && (
        <p className="mt-4 text-success">Payment confirmed. Tickets emailed to {order.buyerEmail}.</p>
      )}
      {order?.status === "Pending" && (
        <p className="mt-4 text-sm text-muted-foreground">Awaiting payment confirmation…</p>
      )}
      {order?.status === "Failed" && (
        <p className="mt-4 text-destructive">Payment failed. Please retry.</p>
      )}
      <Link
        href={`/e/${orgSlug}`}
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        Back to event
      </Link>
    </div>
  );
}
