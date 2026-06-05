/**
 * apps/checkin-admin/src/app/(dashboard)/layout.tsx — I-108
 *
 * Dashboard layout: sidebar (Tenants / Subscriptions / Plans / Audit / Feature Flags / Settings) +
 * topbar (user avatar, logout).
 */
import Link from "next/link";
import { adminLogoutAction } from "@/modules/auth/actions";

const NAV = [
  { href: "/tenants", label: "Tenants" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/plans", label: "Plans" },
  { href: "/audit", label: "Audit" },
  { href: "/feature-flags", label: "Feature Flags" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold">saas-checkin</h1>
          <p className="text-xs text-muted-foreground">Platform Admin</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            "use server";
            await adminLogoutAction();
          }}
          className="p-2 border-t border-border"
        >
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent"
          >
            Đăng xuất
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
