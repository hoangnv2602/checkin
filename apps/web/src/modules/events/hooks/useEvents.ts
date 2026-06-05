/**
 * apps/web/src/modules/events/hooks/useEvents.ts — I-203
 *
 * TanStack Query hooks cho events CRUD. Optimistic update khi publish/cancel.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Event } from "../types/event";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
} from "../services/eventsApi";

export const eventsKeys = {
  all: ["events"] as const,
  list: (params: { status?: string; skip?: number; take?: number }) =>
    [...eventsKeys.all, "list", params] as const,
  detail: (id: string) => [...eventsKeys.all, "detail", id] as const,
};

export function useEventsList(params: { status?: string; skip?: number; take?: number } = {}) {
  return useQuery({
    queryKey: eventsKeys.list(params),
    queryFn: () => listEvents(params),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventsKeys.detail(id),
    queryFn: () => getEvent(id),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createEvent>[0]) => createEvent(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
}

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateEvent>[1]) => updateEvent(id, input),
    onSuccess: (event) => {
      qc.setQueryData(eventsKeys.detail(id), event);
      qc.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
}

export function usePublishEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishEvent(id),
    onMutate: async (id) => {
      // Optimistic: set status = published
      await qc.cancelQueries({ queryKey: eventsKeys.detail(id) });
      const previous = qc.getQueryData<Event>(eventsKeys.detail(id));
      if (previous) {
        qc.setQueryData<Event>(eventsKeys.detail(id), { ...previous, status: "published" });
      }
      return { previous };
    },
    onError: (_err, id, context) => {
      if (context?.previous) {
        qc.setQueryData(eventsKeys.detail(id), context.previous);
      }
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: eventsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
}

export function useCancelEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelEvent(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: eventsKeys.detail(id) });
      const previous = qc.getQueryData<Event>(eventsKeys.detail(id));
      if (previous) {
        qc.setQueryData<Event>(eventsKeys.detail(id), { ...previous, status: "cancelled" });
      }
      return { previous };
    },
    onError: (_err, id, context) => {
      if (context?.previous) {
        qc.setQueryData(eventsKeys.detail(id), context.previous);
      }
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: eventsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
}
