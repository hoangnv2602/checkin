"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, ListChecks, ScrollText, Flag, Settings, UserCog, Activity } from "lucide-react";
import type { ComponentType } from "react";
import { adminLogoutAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DASHBOARD_NAV: Array<{
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/plans", label: "Plans", icon: ListChecks },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/feature-flags", label: "Feature Flags", icon: Flag },
  { href: "/impersonate", label: "Impersonate", icon: UserCog },
  { href: "/metrics", label: "Metrics", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
            sc
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold leading-tight">saas-checkin</h1>
            <p className="text-xs text-muted-foreground">Platform Admin</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {DASHBOARD_NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form
        action={adminLogoutAction}
        className="p-2 border-t border-border"
      >
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
          Đăng xuất
        </Button>
      </form>
    </aside>
  );
}

export function DashboardTopbar() {
  const pathname = usePathname();
  const activeLabel =
    DASHBOARD_NAV.find((n) => pathname === n.href || pathname?.startsWith(n.href + "/"))?.label ?? "Admin";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">{activeLabel}</span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
          {process.env.NEXT_PUBLIC_APP_ENV ?? "dev"}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-mono">platform_owner@saas-checkin.com</span>
      </div>
    </header>
  );
}
