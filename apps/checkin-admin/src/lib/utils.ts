/**
 * apps/checkin-admin/src/lib/utils.ts
 *
 * Tiny class-name merger (mirrors apps/web/src/lib/utils.ts).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
