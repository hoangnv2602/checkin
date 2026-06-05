import { AdminLoginForm } from "@/modules/auth/components/AdminLoginForm";

/**
 * /login — Phase 1 (I-108)
 * Centered card: title + AdminLoginForm.
 */
export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">saas-checkin Admin</h1>
          <p className="text-sm text-muted-foreground">Đăng nhập quản trị nền tảng</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
