"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EventForm, useEvent, useUpdateEvent, usePublishEvent, useCancelEvent } from "@/modules/events";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default function EventDetailPage({ params }: PageProps) {
  const { eventId } = use(params);
  const router = useRouter();
  const { data: event, isLoading, error } = useEvent(eventId);
  const updateMutation = useUpdateEvent(eventId);
  const publishMutation = usePublishEvent();
  const cancelMutation = useCancelEvent();
  const [serverError, setServerError] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Đang tải…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{String(error)}</div>;
  if (!event) return <div className="p-8 text-sm text-muted-foreground">Không tìm thấy sự kiện.</div>;

  const isDraft = event.status === "draft";

  async function onSubmit(values: Parameters<typeof updateMutation.mutateAsync>[0]) {
    setServerError(null);
    try {
      await updateMutation.mutateAsync(values);
      toast.success("Đã cập nhật");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  async function onPublish() {
    if (!confirm("Xuất bản sự kiện này? Sau khi xuất bản, sức chứa không thể giảm dưới số vé đã bán.")) return;
    try {
      await publishMutation.mutateAsync(eventId);
      toast.success("Đã xuất bản");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xuất bản thất bại");
    }
  }

  async function onCancel() {
    if (!confirm("Hủy sự kiện này? Hành động không thể hoàn tác.")) return;
    try {
      await cancelMutation.mutateAsync(eventId);
      toast.success("Đã hủy sự kiện");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hủy thất bại");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chi tiết sự kiện</h1>
        <div className="flex gap-2">
          {isDraft && (
            <Button onClick={onPublish} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? "Đang xuất bản…" : "Xuất bản"}
            </Button>
          )}
          {(event.status === "draft" || event.status === "published") && (
            <Button variant="outline" onClick={onCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? "Đang hủy…" : "Hủy sự kiện"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Trạng thái: <strong>{event.status}</strong> — {event.soldTickets}/{event.capacity} vé đã bán
      </p>

      {isDraft ? (
        <EventForm
          defaultValues={{
            title: event.title,
            description: event.description ?? "",
            startAt: event.startAt.slice(0, 16),
            endAt: event.endAt.slice(0, 16),
            capacity: event.capacity,
          }}
          onSubmit={onSubmit}
          submitLabel="Cập nhật"
          serverError={serverError}
        />
      ) : (
        <div className="space-y-2 max-w-xl">
          <p><strong>Tên:</strong> {event.title}</p>
          {event.description && <p><strong>Mô tả:</strong> {event.description}</p>}
          <p><strong>Bắt đầu:</strong> {new Date(event.startAt).toLocaleString("vi-VN")}</p>
          <p><strong>Kết thúc:</strong> {new Date(event.endAt).toLocaleString("vi-VN")}</p>
          <p><strong>Sức chứa:</strong> {event.capacity}</p>
        </div>
      )}
    </div>
  );
}
