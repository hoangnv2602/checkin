/**
 * apps/web/src/modules/events/components/EventsPage.tsx
 *
 * Composed page-level component for /[orgSlug]/events list view.
 * I-605 polish: EmptyState, SkeletonTable, ErrorBoundary fallback.
 */
"use client";

import { useState } from "react";
import { useEventsList, usePublishEvent, useCancelEvent, useCompleteEvent } from "../hooks/useEvents";
import { EventListItem } from "./EventListItem";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonTable } from "@/modules/_shared/ui";

interface EventsPageProps {
  orgSlug: string;
}

export function EventsPage({ orgSlug }: EventsPageProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, error, refetch } = useEventsList({ status: statusFilter });
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

      <div className="flex flex-wrap gap-2">
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

      {isLoading && <SkeletonTable rows={4} cols={3} />}
      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="text-destructive">Lỗi: {String(error)}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            Thử lại
          </button>
        </div>
      )}
      {data && data.length === 0 && !isLoading && (
        <EmptyState
          title="Chưa có sự kiện nào"
          description="Tạo sự kiện đầu tiên để bắt đầu bán vé và check-in."
          action={
            <Button asChild>
              <a href="/events/new">+ Tạo sự kiện</a>
            </Button>
          }
        />
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
