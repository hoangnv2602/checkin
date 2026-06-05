/**
 * apps/checkin-admin/src/modules/auth/components/AdminMfaSetupForm.tsx — I-108
 *
 * MFA setup: hiện QR code, nhập 1 TOTP code để confirm.
 */
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MfaOtpInput } from "./MfaOtpInput";
import { adminMfaSetupAction, adminMfaVerifyAction } from "../actions";

export function AdminMfaSetupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_setup_token");
    if (!token) {
      setError("Missing setup token. Vui lòng đăng nhập lại.");
      return;
    }
    setSetupToken(token);
    startTransition(async () => {
      try {
        const result = await adminMfaSetupAction(token);
        setQrDataUrl(result.qrCodeDataUrl);
        setSecret(result.secretBase32);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tạo MFA secret");
      }
    });
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setupToken || code.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await adminMfaVerifyAction({ setupToken, totpCode: code });
        if (result.mfaEnabled) {
          sessionStorage.removeItem("admin_setup_token");
          toast.success("MFA đã được kích hoạt");
          router.push("/tenants" as never);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Mã TOTP không đúng";
        setError(message);
      }
    });
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Thiết lập xác thực 2 yếu tố</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quét QR code bằng Google Authenticator / 1Password / Authy
        </p>
      </div>

      {qrDataUrl ? (
        <div className="flex justify-center">
          <img
            src={qrDataUrl}
            alt="QR code cho TOTP secret"
            className="border border-border rounded-md p-2 bg-background"
            width={200}
            height={200}
          />
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground">Đang tạo QR code…</div>
      )}

      {secret ? (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Hoặc nhập secret thủ công:</p>
          <code className="block mt-1 text-sm font-mono bg-muted px-2 py-1 rounded">
            {secret}
          </code>
        </div>
      ) : null}

      <MfaOtpInput onChange={setCode} disabled={isPending} />

      <Button type="submit" className="w-full" disabled={isPending || code.length !== 6}>
        {isPending ? "Đang xác thực…" : "Kích hoạt MFA"}
      </Button>
    </form>
  );
}
