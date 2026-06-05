import { AdminMfaSetupForm } from "@/modules/auth/components/AdminMfaSetupForm";

/**
 * /mfa-setup — Phase 1 (I-108)
 * Hiện QR + TOTP input, kích hoạt MFA.
 */
export default function AdminMfaSetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-8">
        <AdminMfaSetupForm />
      </div>
    </div>
  );
}
