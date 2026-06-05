export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-bold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 0 skeleton — form sẽ thêm ở Phase 1 (I-104).
        </p>
        <div className="mt-6 text-sm text-muted-foreground">
          Email: <code className="rounded bg-muted px-1">owner@acme.test</code>
        </div>
      </div>
    </main>
  );
}
