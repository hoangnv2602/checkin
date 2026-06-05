/**
 * apps/checkin-admin/src/modules/auth/components/AdminLoginForm.tsx — I-108
 *
 * Login form: email + password + optional TOTP code (3 fields 1 form).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { adminLoginSchema, type AdminLoginInput } from "../schemas/admin-auth.schema";
import { adminLoginAction } from "../actions";

export function AdminLoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "", totpCode: "" },
  });

  function onSubmit(values: AdminLoginInput) {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await adminLoginAction(values);
        if (result.mfaRequired) {
          // Store setupToken in sessionStorage so mfa-setup page can use it
          if (result.setupToken) {
            sessionStorage.setItem("admin_setup_token", result.setupToken);
          }
          router.push("/mfa-setup" as never);
        } else {
          toast.success("Đăng nhập thành công");
          router.push((result.redirect ?? "/tenants") as never);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Đăng nhập thất bại";
        setServerError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email quản trị</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Tối thiểu 12 ký tự"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totpCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mã TOTP (nếu đã bật MFA)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
    </Form>
  );
}
