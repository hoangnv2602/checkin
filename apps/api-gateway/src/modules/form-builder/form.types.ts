/**
 * apps/api-gateway/src/modules/form-builder/form.types.ts
 *
 * I-903 — Custom field builder types.
 *
 * FormTemplate: tenant-defined form schema. Aggregate root.
 * FormField: một field trong template (text/number/select/checkbox/date/file).
 *   - key: stable identifier dùng để lưu giá trị vào JSONB
 *   - label: hiển thị
 *   - required: bắt buộc nhập
 *   - options: chỉ dùng cho `select` (single/multi)
 *   - validation: per-type rules
 *
 * Storage ở registration: `custom_field_values JSONB` — chỉ lưu { key: value }.
 * Tránh EAV anti-pattern (table riêng cho từng field type).
 */
export type FormFieldType = "text" | "number" | "email" | "select" | "checkbox" | "date" | "textarea" | "tel";

export const ALL_FORM_FIELD_TYPES: readonly FormFieldType[] = [
  "text", "number", "email", "select", "checkbox", "date", "textarea", "tel",
];

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  /** File size max (bytes) — chỉ field type "file" (Phase 10+). */
  maxFileSize?: number;
}

export interface FormField {
  /** Stable identifier (slug). unique trong template. */
  key: string;
  /** Loại field. */
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  /** Chỉ dùng cho select. */
  options?: string[];
  /** Multi-select (chỉ dùng cho select). */
  multiple?: boolean;
  validation?: FormFieldValidation;
  /** Display order. */
  order: number;
}

export interface FormTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  fields: FormField[];
  /** Event nào gắn với template này. */
  eventId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormTemplateInput {
  name: string;
  description?: string;
  fields: FormField[];
  eventId?: string;
}

export interface FormTemplateUpdate {
  name?: string;
  description?: string;
  fields?: FormField[];
  eventId?: string;
  active?: boolean;
}

/** Validation rules. */
export const FORM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
export const FORM_NAME_MAX_LENGTH = 100;
export const FORM_DESCRIPTION_MAX_LENGTH = 500;
export const FORM_FIELD_LABEL_MAX_LENGTH = 200;
export const FORM_FIELD_HELP_MAX_LENGTH = 500;
export const FORM_FIELD_OPTIONS_MAX = 50;
export const FORM_OPTION_MAX_LENGTH = 100;
export const FORM_FIELDS_MAX = 50;
export const FORM_TEMPLATE_KEY_MAX = 64;

export const FORM_PLAN_QUOTAS: Record<string, { maxTemplates: number; maxFieldsPerTemplate: number }> = {
  free: { maxTemplates: 1, maxFieldsPerTemplate: 5 },
  pro: { maxTemplates: 10, maxFieldsPerTemplate: 25 },
  enterprise: { maxTemplates: 100, maxFieldsPerTemplate: 50 },
  internal: { maxTemplates: 1000, maxFieldsPerTemplate: 100 },
};

export const RESERVED_FIELD_KEYS = new Set([
  "email", "name", "first_name", "last_name", "phone",
  "id", "created_at", "updated_at", "tenant_id", "event_id",
]);
