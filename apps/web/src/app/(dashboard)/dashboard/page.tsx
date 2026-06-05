import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/modules/auth/hooks/useAuth";

/**
 * apps/web/src/app/(dashboard)/dashboard/page.tsx
 *
 * Dashboard landing — hiển thị thông tin user từ /whoami.
 * Layout parent đã guard auth rồi.
 */
export default async function DashboardPage() {
  const session = await useAuth();
  if (!session) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tài khoản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Họ tên" value={session.user.fullName} />
          <Row label="Email" value={session.user.email} />
          <Row
            label="User ID"
            value={session.user.id}
            mono
          />
          <Row
            label="Email verified"
            value={session.user.emailVerified ? "Có" : "Chưa"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant hiện tại</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row
            label="Tenant ID"
            value={session.tenant.id ?? "Chưa chọn"}
            mono
          />
          <Row
            label="Role"
            value={session.tenant.role ?? "—"}
            mono
          />
          <Row
            label="Permissions"
            value={
              session.permissions.length > 0
                ? session.permissions.join(", ")
                : "—"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1 status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Đăng nhập thành công. Org switcher + events/tickets/members modules
            sẽ wire ở các commit tiếp theo (I-105+).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={mono ? "text-sm font-mono text-foreground break-all" : "text-sm text-foreground"}>
        {value}
      </span>
    </div>
  );
}
