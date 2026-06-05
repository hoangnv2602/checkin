import type { LoginResponse, RefreshResponse, RegisterResponse, WhoAmIResponse } from "@saas-checkin/contracts";

export type { LoginResponse, RefreshResponse, RegisterResponse, WhoAmIResponse };

/** Session = thông tin user đang đăng nhập. Lấy từ /v1/auth/whoami. */
export type Session = WhoAmIResponse;
