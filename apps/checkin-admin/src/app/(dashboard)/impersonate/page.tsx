export default function ImpersonatePage() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Impersonate</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Impersonate tenant user để debug — Phase 1, có audit log + time limit.
      </p>
    </main>
  );
}
