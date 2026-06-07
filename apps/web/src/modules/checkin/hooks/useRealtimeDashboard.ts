/**
 * apps/web/src/modules/checkin/hooks/useRealtimeDashboard.ts
 *
 * Subscribe Socket.IO namespace `event:{eventId}:checkin`, merge với React
 * Query cache, expose state cho dashboard (including cumulative + rolling
 * series for charts).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import type { CheckInRecord, EventStats, LeaderboardEntry, AlertEntry } from "../types/checkin";
import { createRollingWindow, type ScanPoint, type BucketPoint } from "../components/CheckinCharts";

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";

export function useRealtimeDashboard(opts: {
  eventId: string;
  organizationId: string;
  token: string;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [cumulative, setCumulative] = useState<ScanPoint[]>([]);
  const [rolling, setRolling] = useState<BucketPoint[]>([]);
  const qc = useQueryClient();
  const rollingRef = useRef(createRollingWindow(30));

  useEffect(() => {
    if (!opts.token) return;
    const s = io(`${BFF}/event/${opts.eventId}/checkin`, {
      query: { organizationId: opts.organizationId },
      auth: { token: opts.token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // exponential backoff capped 10s
      randomizationFactor: 0.5,    // jitter to avoid thundering herd
    });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("AttendeeCheckedIn", (payload: CheckInRecord) => {
      const now = Date.now();
      setCumulative((c) => {
        const last = c[c.length - 1];
        const next = last && now - last.t < 1500
          ? { t: now, cumulative: last.cumulative + 1 }
          : { t: now, cumulative: (last?.cumulative ?? 0) + 1 };
        // Keep last 200 points (~5min @ 1.5s spacing)
        return [...c, next].slice(-200);
      });
      setRolling(rollingRef.current.bump(now));

      qc.setQueryData<EventStats | undefined>(["event-stats", opts.eventId], (prev) =>
        prev
          ? { ...prev, checkedIn: prev.checkedIn + 1, checkInPercent: computePct(prev.checkedIn + 1, prev.totalRegistrations) }
          : prev,
      );
      qc.invalidateQueries({ queryKey: ["recent-records", opts.eventId] });
      setLeaderboard((lb) => bumpGate(lb, payload.gateId, +1));
    });

    s.on("CheckInRejected", (payload: CheckInRecord) => {
      qc.setQueryData<EventStats | undefined>(["event-stats", opts.eventId], (prev) =>
        prev ? { ...prev, rejected: prev.rejected + 1 } : prev,
      );
      setAlerts((a) => [
        { type: "rejected", message: payload.rejectReason ?? "Rejected", scannedAt: payload.scannedAt, recordId: payload.id },
        ...a.slice(0, 49),
      ]);
    });

    s.on("StatsUpdated", (payload: { count: number; totalRegistered?: number | null; checkInPercent?: number | null }) => {
      qc.setQueryData<EventStats | undefined>(["event-stats", opts.eventId], (prev) =>
        prev
          ? {
              ...prev,
              checkedIn: payload.count,
              checkInPercent: payload.checkInPercent ?? computePct(payload.count, prev.totalRegistrations),
              totalRegistrations: payload.totalRegistered ?? prev.totalRegistrations,
            }
          : prev,
      );
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [opts.eventId, opts.organizationId, opts.token, qc]);

  return { socket, connected, alerts, leaderboard, cumulative, rolling };
}

function bumpGate(lb: LeaderboardEntry[], gateId: string, delta: number): LeaderboardEntry[] {
  const found = lb.find((e) => e.gateId === gateId);
  if (found) {
    return lb.map((e) => (e.gateId === gateId ? { ...e, count: e.count + delta } : e));
  }
  return [...lb, { gateId, gateName: `Gate ${gateId.slice(0, 4)}`, count: Math.max(0, delta) }]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computePct(checkedIn: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * checkedIn) / total * 100) / 100;
}
