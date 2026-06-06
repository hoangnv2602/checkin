/**
 * apps/web/src/modules/registration/components/TicketOtpGatePage.tsx
 *
 * /ticket/[regId] — yêu cầu OTP gate trước khi hiện QR. OTP gửi qua email.
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OtpFormSchema, type OtpFormValues } from "../schemas/registration.schema";
import type { Registration } from "../types/ticket";

export function TicketOtpGatePage({ registrationId }: { registrationId: string }) {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<OtpFormValues>({
    resolver: zodResolver(OtpFormSchema),
    defaultValues: { otp: "" },
  });

  async function requestOtp() {
    setError(null);
    try {
      const res = await fetch(`/api/ticket/${registrationId}/otp`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    }
  }

  async function verifyOtp(values: OtpFormValues) {
    setError(null);
    try {
      const res = await fetch(`/api/ticket/${registrationId}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(await res.text());
      const reg = (await res.json()) as Registration;
      setRegistration(reg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid OTP");
    }
  }

  if (registration?.qrImageUrl) {
    return (
      <div className="mx-auto max-w-md rounded border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">Your ticket</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Show this QR at the entrance. Valid until {new Date(registration.expiresAt).toLocaleString()}.
        </p>
        <img
          src={registration.qrImageUrl}
          alt="QR code"
          className="mx-auto mt-4 h-64 w-64 rounded border border-border bg-background p-2"
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Attendee: {registration.attendeeName} ({registration.attendeeEmail})
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded border border-border bg-card p-6">
      <h1 className="text-xl font-semibold text-foreground">Access your ticket</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We&apos;ll email a 6-digit code to the address on file.
      </p>
      {!otpSent ? (
        <button
          onClick={requestOtp}
          className="mt-4 w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
        >
          Send code
        </button>
      ) : (
        <form onSubmit={form.handleSubmit(verifyOtp)} className="mt-4 space-y-3">
          <input
            {...form.register("otp")}
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="w-full rounded border border-input bg-background px-3 py-2 text-center text-2xl tracking-widest text-foreground"
          />
          {form.formState.errors.otp && (
            <p className="text-xs text-destructive">{form.formState.errors.otp.message}</p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            Verify
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
