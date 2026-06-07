/**
 * packages/ui/src/tokens.ts
 *
 * I-909 — Aurora design tokens. Re-export từ mỗi app's globals.css semantic classes.
 * App consumer phải include Aurora CSS (đã có sẵn ở apps/web + apps/checkin-admin).
 *
 * Tokens KHÔNG export raw color values — semantic classes là nguồn truth.
 * Component chỉ dùng Tailwind utility `bg-primary`, `text-foreground`, etc.
 */
export const SEMANTIC_TOKENS = {
  bg: "bg-background",
  bgMuted: "bg-muted",
  bgCard: "bg-card",
  fg: "text-foreground",
  fgMuted: "text-muted-foreground",
  border: "border-border",
  primary: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  ring: "ring-ring",
} as const;

export const SPACING = {
  controlSm: "h-8 px-3 text-sm",
  controlMd: "h-10 px-4 text-sm",
  controlLg: "h-11 px-6 text-base",
} as const;
