/**
 * apps/web/src/modules/events/types/event.ts
 */
export type EventStatus = "draft" | "published" | "cancelled" | "completed";

export interface Event {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  status: EventStatus;
  soldTickets: number;
  createdAt: string;
  updatedAt: string;
}
