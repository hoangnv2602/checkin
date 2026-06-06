/**
 * apps/web/src/i18n/request.ts
 *
 * I-606 — getRequestConfig cho next-intl.
 */
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, defaultLocale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;
  try {
    return {
      locale,
      messages: (await import(`../messages/${locale}.json`)).default,
    };
  } catch {
    notFound();
  }
});
