/**
 * apps/web/src/modules/registration/components/RegisterFormPage.tsx
 *
 * Client component cho form /e/[slug]/register. Submit → /register/pay.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterFormSchema, type RegisterFormValues } from "../schemas/registration.schema";
import type { PublicEvent } from "../types/ticket";
import { formatMoney } from "@/lib/format";

export function RegisterFormPage({ event }: { event: PublicEvent }) {
  const router = useRouter();
  const params = useSearchParams();
  const defaultTt = params.get("tt") ?? event.ticketTypes[0]?.id ?? "";

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      ticketTypeId: defaultTt,
      quantity: 1,
      buyerName: "",
      buyerEmail: "",
      discountCode: "",
      provider: event.enabledProviders[0] ?? "stripe",
    },
  });

  function onSubmit(values: RegisterFormValues) {
    const sp = new URLSearchParams({
      eventId: event.id,
      tt: values.ticketTypeId,
      qty: String(values.quantity),
      name: values.buyerName,
      email: values.buyerEmail,
      provider: values.provider,
    });
    if (values.discountCode) sp.set("code", values.discountCode);
    router.push(`/e/${event.organizationSlug}/register/pay?${sp.toString()}`);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-auto max-w-xl space-y-4 rounded border border-border bg-card p-6"
    >
      <h1 className="text-2xl font-semibold text-foreground">Register for {event.title}</h1>

      <div>
        <label htmlFor="ticketTypeId" className="block text-sm font-medium text-foreground">
          Ticket type
        </label>
        <select
          id="ticketTypeId"
          {...form.register("ticketTypeId")}
          className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        >
          {event.ticketTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {formatMoney(t.price.amountMinor, t.price.currency)}
            </option>
          ))}
        </select>
        {form.formState.errors.ticketTypeId && (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.ticketTypeId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-foreground">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={10}
            {...form.register("quantity")}
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label htmlFor="discountCode" className="block text-sm font-medium text-foreground">
            Discount code (optional)
          </label>
          <input
            id="discountCode"
            {...form.register("discountCode")}
            placeholder="SUMMER20"
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
          />
        </div>
      </div>

      <div>
        <label htmlFor="buyerName" className="block text-sm font-medium text-foreground">
          Full name
        </label>
        <input
          id="buyerName"
          {...form.register("buyerName")}
          className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        />
        {form.formState.errors.buyerName && (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.buyerName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="buyerEmail" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="buyerEmail"
          type="email"
          {...form.register("buyerEmail")}
          className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        />
        {form.formState.errors.buyerEmail && (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.buyerEmail.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
      >
        Continue to payment
      </button>
    </form>
  );
}
