/**
 * apps/checkin-admin/src/modules/auth/schemas/admin-auth.schema.ts — I-108
 *
 * Login form: email + password + optional TOTP code (3 fields 1 form).
 */
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(12, "Mật khẩu tối thiểu 12 ký tự").max(128),
  totpCode: z
    .string()
    .regex(/^\d{6}$/, "Mã TOTP phải đúng 6 chữ số")
    .optional()
    .or(z.literal("")),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminMfaVerifySchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, "Mã TOTP phải đúng 6 chữ số"),
});

export type AdminMfaVerifyInput = z.infer<typeof adminMfaVerifySchema>;
