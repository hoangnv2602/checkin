import { redirect } from "next/navigation";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { DashboardShell } from "./_shell";

/**
 * apps/web/src/app/(dashboard)/layout.tsx
 *
 * Auth guard. Re-fetches /whoami từ BFF mỗi request. Nếu chưa login → redirect.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await useAuth();
  if (!session) {
    redirect("/login?redirect=/dashboard");
  }
  return <DashboardShell session={session}>{children}</DashboardShell>;
}
