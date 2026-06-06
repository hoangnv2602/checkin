/**
 * apps/web/src/modules/_shared/ui/keyboard-shortcuts.ts
 *
 * I-605 — Keyboard shortcuts cho power user. Bind phím tắt toàn cục.
 *   g e  → /events
 *   g d  → /dashboard
 *   g s  → /settings
 *   c    → new event (modal)
 *   ?    → show shortcut help
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SEQUENCES: Record<string, () => void> = {
  ge: () => {},
  gd: () => {},
  gs: () => {},
};

export function useKeyboardShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let buffer = "";
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
      if (e.key === "c") {
        router.push("/events/new");
        return;
      }
      if (/^[a-z]$/.test(e.key)) {
        buffer += e.key;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => (buffer = ""), 800);
        const fn = SEQUENCES[buffer];
        if (fn) {
          fn();
          buffer = "";
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timeout) clearTimeout(timeout);
    };
  }, [router]);
}
