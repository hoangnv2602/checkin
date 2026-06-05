// Shared API types — safe for client import.
export * from "./errors";

// Re-exported here chỉ cho server-side consumers. KHÔNG import file này từ
// "use client" component — sẽ throw "You're importing a component that needs
// server-only env". Client components chỉ cần `AuthError` (từ errors.ts).
export { bffFetch, forwardCookies } from "./client";
