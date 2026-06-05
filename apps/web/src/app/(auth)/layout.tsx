/**
 * apps/web/src/app/(auth)/layout.tsx
 *
 * Auth route group layout — minimal shell, không có sidebar/topbar.
 * Background bg-background để form card nổi bật trên nền muted (handled in AuthPage).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
