/**
 * apps/web/src/modules/events/schemas/event.schema.ts
 *
 * Zod schemas mirror BFF CreateEventDto / UpdateEventDto (I-202).
 */
import { z } from "zod";

export const eventStatusSchema = z.enum(["draft", "published", "cancelled", "completed"]);

const baseEventSchema = z.object({
  title: z.string().min(1, "Tên sự kiện bắt buộc").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  startAt: z.string().min(1, "Ngày bắt đầu bắt buộc"),
  endAt: z.string().min(1, "Ngày kết thúc bắt buộc"),
  capacity: z.coerce.number().int().min(1, "Tối thiểu 1").max(1_000_000),
});

export const createEventSchema = baseEventSchema.refine(
  (d) => new Date(d.startAt) < new Date(d.endAt),
  { message: "Ngày bắt đầu phải trước ngày kết thúc", path: ["endAt"] },
);

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = baseEventSchema.partial().refine(
  (d) => !d.startAt || !d.endAt || new Date(d.startAt) < new Date(d.endAt),
  { message: "Ngày bắt đầu phải trước ngày kết thúc", path: ["endAt"] },
);
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
