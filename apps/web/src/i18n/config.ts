/**
 * apps/web/src/i18n/config.ts
 *
 * I-606 — Locale list + default. Wire next-intl ở Phase 6.
 */
export const locales = ["en", "vi", "ja", "en-XA"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(s: string): s is Locale {
  return (locales as readonly string[]).includes(s);
}
