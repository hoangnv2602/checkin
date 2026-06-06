/**
 * apps/checkin-admin/src/app/(dashboard)/layout.tsx — I-108
 *
 * Server component shell. Sidebar + topbar là client components
 * (xem ./DashboardSidebar.tsx) vì dùng usePathname() để highlight active.
 *
 * Style: Aurora design system. Token references — KHÔNG dùng default Tailwind palette.
 */
import { DashboardSidebar, DashboardTopbar } from "./DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-muted/40">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardTopbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
