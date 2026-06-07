/**
 * apps/web/src/modules/_shared/ui/keyboard-shortcuts.ts
 *
 * I-605 — Keyboard shortcuts cho power user. Bind phím tắt toàn cục.
 *   g e  → /[orgSlug]/events
 *   g d  → /[orgSlug]/dashboard
 *   g s  → /[orgSlug]/settings
 *   c    → /[orgSlug]/events/new
 *   ?    → show shortcut help
 *
 * `orgSlug` is taken from the current URL prefix so the shortcut stays
 * within the current tenant.
 */
"use client";

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

const SEQUENCES: Record<string, string> = {
  ge: "events",
  gd: "dashboard",
  gs: "settings",
};

export function useKeyboardShortcuts() {
  const router = useRouter();
  const params = useParams<{ orgSlug?: string }>();
  const pathname = usePathname();

  useEffect(() => {
    let buffer = "";
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.key === "?") {
        alert(
          "Keyboard shortcuts:\n" +
            "  g e  → Events\n" +
            "  g d  → Dashboard\n" +
            "  g s  → Settings\n" +
            "  c    → Create event\n" +
            "  ?    → Show this help",
        );
        return;
      }
      if (e.key === "c" && params.orgSlug) {
        router.push(`/${params.orgSlug}/events/new`);
        return;
      }
      if (/^[a-z]$/.test(e.key)) {
        buffer += e.key;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => (buffer = ""), 800);
        const dest = SEQUENCES[buffer];
        if (dest && params.orgSlug) {
          router.push(`/${params.orgSlug}/${dest}`);
          buffer = "";
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timeout) clearTimeout(timeout);
    };
  }, [router, params.orgSlug, pathname]);
}
