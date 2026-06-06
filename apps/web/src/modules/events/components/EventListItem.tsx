/**
 * apps/web/src/modules/events/components/EventListItem.tsx
 */
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Event } from "../types/event";

interface EventListItemProps {
  event: Event;
  onPublish?: (id: string) => void;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
  publishing?: boolean;
  cancelling?: boolean;
  completing?: boolean;
}

const STATUS_LABEL: Record<Event["status"], string> = {
  draft: "Nháp",
  published: "Đã xuất bản",
  cancelled: "Đã hủy",
  completed: "Đã hoàn thành",
};

const STATUS_CLASS: Record<Event["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  completed: "bg-secondary/10 text-secondary-foreground",
};

export function EventListItem({ event, onPublish, onCancel, onComplete, publishing, cancelling, completing }: EventListItemProps) {
  return (
    <div className="border border-border rounded-md p-4 bg-card flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Link href={`/events/${event.id}` as never} className="font-medium hover:underline">
            {event.title}
          </Link>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[event.status]}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(event.startAt).toLocaleString("vi-VN")} — {new Date(event.endAt).toLocaleString("vi-VN")}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.soldTickets} / {event.capacity} vé đã bán
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {event.status === "draft" && onPublish ? (
          <Button size="sm" onClick={() => onPublish(event.id)} disabled={publishing}>
            {publishing ? "Đang xuất bản…" : "Xuất bản"}
          </Button>
        ) : null}
        {event.status === "published" && onComplete ? (
          <Button size="sm" variant="secondary" onClick={() => onComplete(event.id)} disabled={completing}>
            {completing ? "Đang hoàn thành…" : "Hoàn thành"}
          </Button>
        ) : null}
        {(event.status === "draft" || event.status === "published") && onCancel ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCancel(event.id)}
            disabled={cancelling}
          >
            {cancelling ? "Đang hủy…" : "Hủy"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
