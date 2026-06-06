import Link from "next/link";
import { AdminLoginForm } from "@/modules/auth/components/AdminLoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * /login — Phase 1 (I-108)
 * Centered card với Aurora design system tokens.
 */
export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">
            sc
          </div>
          <CardTitle className="text-2xl">saas-checkin Admin</CardTitle>
          <CardDescription>Đăng nhập quản trị nền tảng (BYPASSRLS role)</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
        </CardContent>
        <div className="px-6 pb-6 text-center">
          <Link
            href="https://saas-checkin.com"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Quay lại saas-checkin.com
          </Link>
        </div>
      </Card>
    </div>
  );
}
