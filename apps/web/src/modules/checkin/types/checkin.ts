/**
 * apps/web/src/modules/checkin/types/checkin.ts
 *
 * Domain types cho dashboard realtime.
 */
export type CheckInStatus = "Success" | "Rejected" | "Duplicate";

export interface CheckInRecord {
  id: string;
  organizationId: string;
  eventId: string;
  registrationId: string;
  jti: string;
  gateId: string;
  staffUserId: string;
  status: CheckInStatus;
  rejectReason: string | null;
  scannedAt: string;
}

export interface EventStats {
  eventId: string;
  totalRegistrations: number;
  checkedIn: number;
  rejected: number;
  duplicates: number;
  checkInPercent: number;
}

export interface LeaderboardEntry {
  gateId: string;
  gateName: string;
  count: number;
}

export interface AlertEntry {
  type: "duplicate" | "rejected" | "suspicious";
  message: string;
  scannedAt: string;
  recordId: string;
}
