/**
 * apps/web/src/modules/events/components/EventsPage.tsx
 *
 * Composed page-level component for /[orgSlug]/events list view.
 */
"use client";

import { useState } from "react";
import { useEventsList, usePublishEvent, useCancelEvent, useCompleteEvent } from "../hooks/useEvents";
import { EventListItem } from "./EventListItem";
import { Button } from "@/components/ui/button";

interface EventsPageProps {
  orgSlug: string;
}

export function EventsPage({ orgSlug }: EventsPageProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, error } = useEventsList({ status: statusFilter });
  const publishMutation = usePublishEvent();
  const cancelMutation = useCancelEvent();
  const completeMutation = useCompleteEvent();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sự kiện</h1>
          <p className="text-sm text-muted-foreground">{orgSlug}</p>
        </div>
        <Button asChild>
          <a href="/events/new">+ Tạo sự kiện</a>
        </Button>
      </div>

      <div className="flex gap-2">
        {["draft", "published", "cancelled", "completed"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(statusFilter === s ? undefined : s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
      {error && <p className="text-sm text-destructive">Lỗi: {String(error)}</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">Chưa có sự kiện nào.</p>
      )}
      <div className="space-y-2">
        {data?.map((event) => (
          <EventListItem
            key={event.id}
            event={event}
            onPublish={(id) => publishMutation.mutate(id)}
            onCancel={(id) => cancelMutation.mutate(id)}
            onComplete={(id) => completeMutation.mutate(id)}
            publishing={publishMutation.isPending && publishMutation.variables === event.id}
            cancelling={cancelMutation.isPending && cancelMutation.variables === event.id}
            completing={completeMutation.isPending && completeMutation.variables === event.id}
          />
        ))}
      </div>
    </div>
  );
}
