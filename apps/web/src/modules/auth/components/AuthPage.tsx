/**
 * apps/web/src/modules/auth/components/AuthPage.tsx
 *
 * Composed auth page — chọn LoginForm hoặc RegisterForm theo `mode`.
 * Render shadcn Card với Aurora tokens.
 */
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

interface AuthPageProps {
  mode: "login" | "register";
  redirect?: string;
}

export function AuthPage({ mode, redirect }: AuthPageProps) {
  const isLogin = mode === "login";
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isLogin ? "Đăng nhập" : "Tạo tài khoản"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Đăng nhập vào SaaS Check-in"
              : "Tạo tổ chức và tài khoản quản trị viên đầu tiên"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogin ? <LoginForm redirect={redirect} /> : <RegisterForm redirect={redirect} />}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? (
              <>
                Chưa có tài khoản?{" "}
                <Link
                  href={(redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : "/register") as never}
                  className="text-primary hover:underline"
                >
                  Đăng ký
                </Link>
              </>
            ) : (
              <>
                Đã có tài khoản?{" "}
                <Link
                  href={(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login") as never}
                  className="text-primary hover:underline"
                >
                  Đăng nhập
                </Link>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
