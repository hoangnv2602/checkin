/**
 * apps/web/src/app/(marketing)/privacy/page.tsx
 *
 * I-706 — Public privacy policy page. Source of truth: `docs/legal/privacy-policy.md`
 * (this page is a simplified version for legal review). When the legal team signs
 * off, both files should match exactly.
 */
import { redirect } from "next/navigation";

export default function PrivacyPage() {
  // During pre-launch, redirect to docs/legal/privacy-policy.md (md file is the
  // canonical source). After legal sign-off + I-706, replace this with the
  // fully-styled page.
  redirect(
    "https://github.com/saas-checkin/platform/blob/develop/docs/legal/privacy-policy.md",
  );
}
