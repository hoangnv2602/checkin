"use client";

/**
 * apps/web/src/modules/auth/components/RegisterForm.tsx
 *
 * Register form — 5 fields: email, fullName, password, organizationName, organizationSlug.
 * Submit qua Server Action `registerAction`. Slug tự sinh từ orgName
 * nếu user để trống.
 */
import { useEffect, useState, useTransition } from "react";
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
import { registerSchema, type RegisterInput } from "../schemas/auth.schema";
import { AuthError } from "@/modules/_shared/api/errors";
import { registerActionClient } from "../actions";

interface RegisterFormProps {
  redirect?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function RegisterForm({ redirect }: RegisterFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      fullName: "",
      password: "",
      organizationName: "",
      organizationSlug: "",
    },
  });

  const orgName = form.watch("organizationName");
  const orgSlug = form.watch("organizationSlug");

  useEffect(() => {
    if (!slugTouched && orgName) {
      form.setValue("organizationSlug", slugify(orgName), { shouldValidate: false });
    }
  }, [orgName, slugTouched, form]);

  useEffect(() => {
    if (orgSlug && orgSlug !== slugify(orgName)) setSlugTouched(true);
  }, [orgSlug, orgName]);

  function onSubmit(values: RegisterInput) {
    setServerError(null);
    startTransition(async () => {
      try {
        await registerActionClient(values);
        toast.success("Tạo tài khoản thành công");
        router.push((redirect ?? "/dashboard") as never);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.status === 409
              ? "Email hoặc slug đã tồn tại"
              : err.message
            : err instanceof Error
              ? err.message
              : "Đăng ký thất bại";
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ và tên</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
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
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organizationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên tổ chức</FormLabel>
              <FormControl>
                <Input autoComplete="organization" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organizationSlug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug tổ chức</FormLabel>
              <FormControl>
                <Input
                  placeholder="acme"
                  autoComplete="off"
                  {...field}
                  onChange={(e) => {
                    setSlugTouched(true);
                    field.onChange(e);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </Button>
      </form>
    </Form>
  );
}
