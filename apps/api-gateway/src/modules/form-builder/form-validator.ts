/**
 * apps/api-gateway/src/modules/form-builder/form-validator.ts
 *
 * I-903 — Pure validation functions. Không phụ thuộc NestJS, dùng được
 * cho cả BFF validation và Next.js dynamic form build (compile zod schema).
 */
import type { FormField, FormTemplate } from "./form.types";
import {
  ALL_FORM_FIELD_TYPES,
  FORM_FIELDS_MAX,
  FORM_FIELD_HELP_MAX_LENGTH,
  FORM_FIELD_KEY_PATTERN,
  FORM_FIELD_LABEL_MAX_LENGTH,
  FORM_FIELD_OPTIONS_MAX,
  FORM_FIELDS_MAX as _MAX,
  FORM_NAME_MAX_LENGTH,
  FORM_OPTION_MAX_LENGTH,
  FORM_PLAN_QUOTAS,
  FORM_TEMPLATE_KEY_MAX,
  RESERVED_FIELD_KEYS,
} from "./form.types";

export interface ValidationFailure {
  ok: false;
  errors: string[];
}

export interface ValidationSuccess {
  ok: true;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function ok(): ValidationSuccess {
  return { ok: true };
}
function fail(errors: string[]): ValidationFailure {
  return { ok: false, errors };
}

/** Validate FormTemplateInput — structural + business rules. */
export function validateTemplate(
  input: { name?: string; description?: string; fields?: FormField[]; eventId?: string },
  plan: string,
): ValidationResult {
  const errors: string[] = [];

  // Name
  if (!input.name || typeof input.name !== "string") {
    errors.push("name is required");
  } else if (input.name.length > FORM_NAME_MAX_LENGTH) {
    errors.push(`name max ${FORM_NAME_MAX_LENGTH} chars`);
  }

  // Description
  if (input.description !== undefined && input.description.length > 500) {
    errors.push("description max 500 chars");
  }

  // Fields
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    errors.push("fields is required and must be non-empty");
    return fail(errors);
  }
  const quota = FORM_PLAN_QUOTAS[plan] ?? FORM_PLAN_QUOTAS.free;
  if (input.fields.length > quota.maxFieldsPerTemplate) {
    errors.push(`plan ${plan} max ${quota.maxFieldsPerTemplate} fields per template`);
  }
  if (input.fields.length > FORM_FIELDS_MAX) {
    errors.push(`hard cap ${FORM_FIELDS_MAX} fields`);
  }

  // Per-field
  const seenKeys = new Set<string>();
  for (let i = 0; i < input.fields.length; i++) {
    const f = input.fields[i];
    validateField(f, i, errors);
    if (seenKeys.has(f.key)) errors.push(`duplicate field key: ${f.key} (index ${i})`);
    seenKeys.add(f.key);
  }

  return errors.length === 0 ? ok() : fail(errors);
}

function validateField(f: FormField | undefined, index: number, errors: string[]): void {
  if (!f || typeof f !== "object") {
    errors.push(`field[${index}] is not an object`);
    return;
  }
  // key
  if (!f.key || typeof f.key !== "string") {
    errors.push(`field[${index}].key is required`);
  } else if (f.key.length > FORM_TEMPLATE_KEY_MAX) {
    errors.push(`field[${index}].key max ${FORM_TEMPLATE_KEY_MAX} chars`);
  } else if (!FORM_FIELD_KEY_PATTERN.test(f.key)) {
    errors.push(`field[${index}].key must match /^[a-z][a-z0-9_]{0,63}$/`);
  } else if (RESERVED_FIELD_KEYS.has(f.key)) {
    errors.push(`field[${index}].key "${f.key}" is reserved`);
  }

  // type
  if (!ALL_FORM_FIELD_TYPES.includes(f.type)) {
    errors.push(`field[${index}].type must be one of: ${ALL_FORM_FIELD_TYPES.join(", ")}`);
  }

  // label
  if (!f.label || typeof f.label !== "string") {
    errors.push(`field[${index}].label is required`);
  } else if (f.label.length > FORM_FIELD_LABEL_MAX_LENGTH) {
    errors.push(`field[${index}].label max ${FORM_FIELD_LABEL_MAX_LENGTH} chars`);
  }

  // helpText
  if (f.helpText !== undefined && f.helpText.length > FORM_FIELD_HELP_MAX_LENGTH) {
    errors.push(`field[${index}].helpText max ${FORM_FIELD_HELP_MAX_LENGTH} chars`);
  }

  // required
  if (typeof f.required !== "boolean") {
    errors.push(`field[${index}].required must be boolean`);
  }

  // order
  if (typeof f.order !== "number" || !Number.isFinite(f.order)) {
    errors.push(`field[${index}].order must be finite number`);
  }

  // options (select only)
  if (f.type === "select") {
    if (!Array.isArray(f.options) || f.options.length === 0) {
      errors.push(`field[${index}].options required for type=select`);
    } else if (f.options.length > FORM_FIELD_OPTIONS_MAX) {
      errors.push(`field[${index}].options max ${FORM_FIELD_OPTIONS_MAX}`);
    } else {
      for (let j = 0; j < f.options.length; j++) {
        if (typeof f.options[j] !== "string" || (f.options[j] as string).length > FORM_OPTION_MAX_LENGTH) {
          errors.push(`field[${index}].options[${j}] must be string ≤ ${FORM_OPTION_MAX_LENGTH} chars`);
        }
      }
    }
  } else if (f.options !== undefined) {
    errors.push(`field[${index}].options only valid for type=select`);
  }

  // validation
  if (f.validation !== undefined) {
    const v = f.validation;
    if (f.type === "text" || f.type === "textarea") {
      if (v.minLength !== undefined && (typeof v.minLength !== "number" || v.minLength < 0)) {
        errors.push(`field[${index}].validation.minLength invalid`);
      }
      if (v.maxLength !== undefined && (typeof v.maxLength !== "number" || v.maxLength < 0)) {
        errors.push(`field[${index}].validation.maxLength invalid`);
      }
      if (v.pattern !== undefined) {
        try {
          new RegExp(v.pattern);
        } catch {
          errors.push(`field[${index}].validation.pattern is not a valid regex`);
        }
      }
    }
    if (f.type === "number") {
      if (v.min !== undefined && typeof v.min !== "number") errors.push(`field[${index}].validation.min invalid`);
      if (v.max !== undefined && typeof v.max !== "number") errors.push(`field[${index}].validation.max invalid`);
    }
  }
}

/** Validate user-submitted values against template. Return {ok, errorsByKey}. */
export function validateSubmission(
  template: FormTemplate,
  values: Record<string, unknown>,
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const f of template.fields) {
    const v = values[f.key];
    const present = v !== undefined && v !== null && v !== "";
    if (f.required && !present) {
      errors[f.key] = "required";
      continue;
    }
    if (!present) continue;
    if (f.type === "email" && typeof v === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      errors[f.key] = "invalid email";
    }
    if (f.type === "number" && typeof v !== "number") {
      errors[f.key] = "must be a number";
    }
    if (f.type === "select" && typeof v === "string" && f.options && !f.options.includes(v)) {
      errors[f.key] = `must be one of: ${f.options.join(", ")}`;
    }
    if (f.type === "date" && typeof v === "string" && Number.isNaN(Date.parse(v))) {
      errors[f.key] = "invalid date";
    }
    if (f.type === "checkbox" && typeof v !== "boolean") {
      errors[f.key] = "must be boolean";
    }
    const minLen = f.validation?.minLength;
    const maxLen = f.validation?.maxLength;
    if (typeof v === "string") {
      if (minLen !== undefined && v.length < minLen) errors[f.key] = `min length ${minLen}`;
      if (maxLen !== undefined && v.length > maxLen) errors[f.key] = `max length ${maxLen}`;
    }
    if (f.type === "number" && typeof v === "number") {
      if (f.validation?.min !== undefined && v < f.validation.min) errors[f.key] = `min ${f.validation.min}`;
      if (f.validation?.max !== undefined && v > f.validation.max) errors[f.key] = `max ${f.validation.max}`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Sinh zod-style schema descriptor (string) cho dynamic form rendering ở client. */
export function schemaToJsonSchema(template: FormTemplate): {
  type: "object";
  required: string[];
  properties: Record<string, unknown>;
} {
  const required: string[] = [];
  const properties: Record<string, unknown> = {};
  for (const f of [...template.fields].sort((a, b) => a.order - b.order)) {
    if (f.required) required.push(f.key);
    properties[f.key] = fieldToJsonSchema(f);
  }
  return { type: "object", required, properties };
}

function fieldToJsonSchema(f: FormField): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: f.label,
    description: f.helpText,
  };
  switch (f.type) {
    case "text":
    case "textarea":
    case "email":
    case "tel":
      base.type = "string";
      if (f.type === "email") base.format = "email";
      if (f.validation?.minLength !== undefined) base.minLength = f.validation.minLength;
      if (f.validation?.maxLength !== undefined) base.maxLength = f.validation.maxLength;
      if (f.validation?.pattern !== undefined) base.pattern = f.validation.pattern;
      break;
    case "number":
      base.type = "number";
      if (f.validation?.min !== undefined) base.minimum = f.validation.min;
      if (f.validation?.max !== undefined) base.maximum = f.validation.max;
      break;
    case "checkbox":
      base.type = "boolean";
      break;
    case "date":
      base.type = "string";
      base.format = "date";
      break;
    case "select":
      if (f.multiple) {
        base.type = "array";
        base.items = { type: "string", enum: f.options ?? [] };
      } else {
        base.type = "string";
        base.enum = f.options ?? [];
      }
      break;
  }
  return base;
}
