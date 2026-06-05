/**
 * apps/web/src/modules/auth/components/LoginForm.test.tsx
 *
 * Component test cho LoginForm — render + submit + zod validation.
 * Mock Server Action + next/navigation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const loginActionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("../actions", () => ({
  loginActionClient: (input: unknown) => loginActionMock(input),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    loginActionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders email + password fields + submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it("does not call loginAction when email is invalid (zod blocks)", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/mật khẩu/i), "PlainP@ss123");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    // Allow RHF to run resolver
    await new Promise((r) => setTimeout(r, 100));
    // loginAction must NOT have been called when zod schema fails
    expect(loginActionMock).not.toHaveBeenCalled();
  });

  it("shows zod error for short password", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "alice@acme.test");
    await user.type(screen.getByLabelText(/mật khẩu/i), "x");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await waitFor(() => {
      expect(screen.getByText(/mật khẩu tối thiểu 8 ký tự/i)).toBeInTheDocument();
    });
  });

  it("calls loginAction with form values + redirects on success", async () => {
    loginActionMock.mockResolvedValueOnce({ userId: "u-1", accessToken: "a", accessExpiresAt: "x" });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "alice@acme.test");
    await user.type(screen.getByLabelText(/mật khẩu/i), "PlainP@ss123");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await waitFor(() => {
      expect(loginActionMock).toHaveBeenCalledWith({
        email: "alice@acme.test",
        password: "PlainP@ss123",
      });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("respects custom redirect prop on success", async () => {
    loginActionMock.mockResolvedValueOnce({ userId: "u-1", accessToken: "a", accessExpiresAt: "x" });
    const user = userEvent.setup();
    render(<LoginForm redirect="/events" />);
    await user.type(screen.getByLabelText(/email/i), "alice@acme.test");
    await user.type(screen.getByLabelText(/mật khẩu/i), "PlainP@ss123");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/events");
    });
  });

  it("shows Vietnamese 401 message on AuthError", async () => {
    const { AuthError } = await import("@/modules/_shared/api/errors");
    loginActionMock.mockRejectedValueOnce(new AuthError(401, "Unauthorized"));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "alice@acme.test");
    await user.type(screen.getByLabelText(/mật khẩu/i), "WrongPassword1");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await waitFor(() => {
      expect(screen.getByText(/email hoặc mật khẩu không đúng/i)).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
