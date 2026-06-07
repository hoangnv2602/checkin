/**
 * apps/web/src/lib/format.ts — formatting utilities.
 */

/** "3s ago", "5m ago", "2h ago", "Jan 5". */
export function formatTimeAgo(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const diff = Date.now() - t;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Format a Money minor-unit value with currency. */
export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(major);
}
