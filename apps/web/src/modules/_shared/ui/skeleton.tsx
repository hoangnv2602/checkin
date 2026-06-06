/**
 * apps/web/src/modules/_shared/ui/skeleton.tsx
 *
 * I-605 — Loading skeleton. Dùng thay spinner cho query chậm (>200ms).
 * Shimmer animation tinh tế, không distract.
 */
import type { CSSProperties } from "react";

const SHIMMER_KEYFRAMES = `
@keyframes skeleton-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
`;

export function Skeleton({
  width,
  height,
  rounded = "rounded",
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  rounded?: string;
  className?: string;
}) {
  const style: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    background: "linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--card)) 50%, hsl(var(--muted)) 100%)",
    backgroundSize: "200px 100%",
    animation: "skeleton-shimmer 1.5s ease-in-out infinite",
  };
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_KEYFRAMES }} />
      <div className={`${rounded} ${className}`} style={style} aria-hidden />
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-2 rounded border border-border bg-card p-4">
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="40%" />
      <Skeleton height={14} width="80%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} height={20} width="25%" />
          ))}
        </div>
      ))}
    </div>
  );
}
