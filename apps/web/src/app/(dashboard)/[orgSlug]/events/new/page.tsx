"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EventForm, useCreateEvent, type CreateEventInput } from "@/modules/events";

export default function NewEventPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const createMutation = useCreateEvent();

  async function onSubmit(values: CreateEventInput) {
    setServerError(null);
    try {
      const event = await createMutation.mutateAsync(values);
      toast.success("Đã tạo sự kiện");
      router.push(`/events/${event.id}` as never);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Tạo sự kiện thất bại");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Tạo sự kiện</h1>
      <EventForm onSubmit={onSubmit} submitLabel="Tạo" serverError={serverError} />
    </div>
  );
}
