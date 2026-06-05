export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-bold">Platform Admin Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 0 skeleton. MFA TOTP flow (Phase 1): login → /mfa-setup.
        </p>
      </div>
    </main>
  );
}
