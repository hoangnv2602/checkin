"use client";

/**
 * apps/web/src/app/(dashboard)/_shell.tsx
 *
 * Dashboard layout shell — sidebar (240px) + main với topbar.
 * Underscore prefix trong tên file để Next.js KHÔNG treat như route.
 * Client component vì cần onClick (logout).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logoutActionClient } from "@/modules/auth";
import type { Session } from "@/modules/auth";

export function DashboardShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutActionClient();
      toast.success("Đã đăng xuất");
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-muted">
      <aside className="bg-card border-r border-border p-4 flex flex-col">
        <h2 className="text-lg font-semibold text-foreground">SaaS Check-in</h2>
        <nav className="mt-6 space-y-1 flex-1">
          <Link
            href="/dashboard"
            className="block px-3 py-2 rounded-md text-sm bg-secondary text-secondary-foreground"
          >
            Dashboard
          </Link>
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Đăng nhập với</p>
          <p className="text-sm font-medium text-foreground truncate">{session.user.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
            disabled={isPending}
          >
            {isPending ? "Đang đăng xuất…" : "Đăng xuất"}
          </Button>
        </div>
      </aside>
      <main className="p-8 overflow-y-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <span className="text-sm text-muted-foreground">
            {session.user.fullName}
          </span>
        </header>
        {children}
      </main>
    </div>
  );
}
