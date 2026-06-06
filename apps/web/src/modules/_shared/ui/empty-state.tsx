/**
 * apps/web/src/modules/_shared/ui/empty-state.tsx
 *
 * I-605 — Empty state. Dùng cho mọi list page không có data.
 */
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border bg-card/50 p-12 text-center">
      {icon && <div className="mb-3 text-4xl text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
