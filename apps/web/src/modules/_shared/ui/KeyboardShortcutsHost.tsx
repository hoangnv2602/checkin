/**
 * apps/web/src/modules/_shared/ui/KeyboardShortcutsHost.tsx
 *
 * I-605 — Mounts the keyboard shortcuts listener once at the app root.
 * Lives outside the route tree so the listener survives route changes.
 */
"use client";

import { useKeyboardShortcuts } from "./keyboard-shortcuts";

export function KeyboardShortcutsHost() {
  useKeyboardShortcuts();
  return null;
}
