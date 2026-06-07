/**
 * apps/web/src/modules/checkin/components/CheckinCharts.tsx
 *
 * I-404 — Inline SVG charts cho checkin dashboard.
 *  - LineChart: cumulative checked-in over time (sparkline)
 *  - BarChart: 30s rolling window scan rate
 *
 * Không dùng external chart lib — render SVG inline với Tailwind tokens
 * (semantic colors: text-foreground, bg-success, etc.).
 */
"use client";

import { useMemo } from "react";

export type ScanPoint = { t: number; cumulative: number };

export function CheckinLineChart({ data }: { data: ScanPoint[] }) {
  const { path, max } = useMemo(() => {
    if (data.length === 0) return { path: "", max: 1 };
    const w = 600, h = 80;
    const max = Math.max(1, data[data.length - 1]?.cumulative ?? 0);
    const xstep = data.length > 1 ? w / (data.length - 1) : w;
    const points = data.map((p, i) => {
      const x = i * xstep;
      const y = h - (h * p.cumulative) / max;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { path: `M ${points.join(" L ")}`, max };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Waiting for scans…</p>
    );
  }

  return (
    <svg viewBox="0 0 600 80" className="h-20 w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative check-ins">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-success" />
    </svg>
  );
}

export type BucketPoint = { t: number; count: number };

export function CheckinBarChart({ data }: { data: BucketPoint[] }) {
  const max = Math.max(1, ...data.map((b) => b.count));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No scans in the last 30s</p>;
  }
  return (
    <div className="flex h-20 items-end gap-1" role="img" aria-label="Scans per second (last 30s)">
      {data.map((b, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? 2 : 0 }}
          title={`${b.count} scans`}
        />
      ))}
    </div>
  );
}

/**
 * Accumulator: keep a sliding window of last 30s of {t, count} samples.
 */
export function createRollingWindow(windowSeconds = 30) {
  const buckets: { t: number; count: number }[] = [];
  return {
    bump(now: number = Date.now()) {
      const slot = Math.floor(now / 1000);
      const last = buckets[buckets.length - 1];
      if (last && last.t === slot) last.count++;
      else buckets.push({ t: slot, count: 1 });
      const cutoff = slot - windowSeconds;
      while (buckets.length > 0 && buckets[0].t < cutoff) buckets.shift();
      return [...buckets];
    },
    snapshot() {
      return [...buckets];
    },
  };
}
