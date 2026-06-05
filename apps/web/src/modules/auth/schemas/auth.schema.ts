import { z } from "zod";

/**
 * Login form schema — mirror BFF LoginDto
 * (apps/api-gateway/src/modules/auth/dto/auth.dto.ts:9-19).
 */
export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Register form schema — mirror BFF RegisterDto.
 * Slug regex: ^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$ (cùng .NET OrgSlug VO).
 */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  fullName: z.string().min(1, "Vui lòng nhập họ tên").max(200),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128),
  organizationName: z.string().min(2, "Tên tổ chức tối thiểu 2 ký tự").max(200),
  organizationSlug: z
    .string()
    .min(2, "Slug tối thiểu 2 ký tự")
    .max(40)
    .regex(SLUG_RE, "Slug chỉ chứa chữ thường, số, và dấu gạch ngang"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
