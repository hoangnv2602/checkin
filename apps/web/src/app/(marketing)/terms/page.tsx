/**
 * apps/web/src/app/(marketing)/terms/page.tsx
 *
 * I-706 — Public terms of service page. Source of truth: `docs/legal/terms-of-service.md`.
 * Same as privacy — redirect to canonical markdown during pre-launch.
 */
import { redirect } from "next/navigation";

export default function TermsPage() {
  redirect(
    "https://github.com/saas-checkin/platform/blob/develop/docs/legal/terms-of-service.md",
  );
}
