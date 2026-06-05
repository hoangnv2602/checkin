export default function TenantsPage() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Tenants</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Platform owner view — list, suspend, refund, audit.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Phase 0 mock data. Real API tới core-api (qua app_platform_owner role + BYPASSRLS) ở Phase 1.
      </p>
    </main>
  );
}
