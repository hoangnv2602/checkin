/**
 * apps/web/test/server-only-stub.ts
 *
 * No-op stub for the `server-only` package — import ở client components sẽ
 * throw runtime error trong production. Trong test env, ta dùng stub này để
 * cho phép unit test import các module có "use server" / server-only.
 */
export {};
