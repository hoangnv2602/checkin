/**
 * packages/ui/src/utils.ts
 *
 * I-909 — cn() helper. Merge Tailwind classes với clsx + tailwind-merge.
 * Đảm bảo later class wins (override earlier).
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
