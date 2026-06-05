export default function MfaSetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-bold">MFA Setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          TOTP QR code + verify flow — Phase 1.
        </p>
      </div>
    </main>
  );
}
