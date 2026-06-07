# Custom field builder (I-903)

> **Phase 9 — Platform Maturity.** Tenant tự định nghĩa registration form fields
> (text/number/email/select/checkbox/date/textarea/tel). Render dynamic từ
> JSON Schema ở Next.js, validate server-side qua BFF, persist vào
> `registrations.custom_field_values` (JSONB).

## Field types

| Type | JSON Schema | Notes |
|------|-------------|-------|
| `text` | `{ type: "string" }` | minLength, maxLength, pattern |
| `textarea` | `{ type: "string" }` | minLength, maxLength |
| `email` | `{ type: "string", format: "email" }` | server validate RFC-lite |
| `number` | `{ type: "number" }` | min, max |
| `select` | `{ type: "string", enum: [...] }` | options required (max 50) |
| `select` + `multiple` | `{ type: "array", items: { enum } }` | |
| `checkbox` | `{ type: "boolean" }` | |
| `date` | `{ type: "string", format: "date" }` | ISO 8601 |
| `tel` | `{ type: "string" }` | pattern validate (\+?\d{6,15}) |

## Reserved keys

`email`, `name`, `first_name`, `last_name`, `phone`, `id`, `created_at`, `updated_at`, `tenant_id`, `event_id`.

Field key phải match `/^[a-z][a-z0-9_]{0,63}$/` (slug, lowercase, ≤ 64 chars).

## Plan quota

| Plan | Templates | Fields per template |
|------|-----------|---------------------|
| Free | 1 | 5 |
| Pro | 10 | 25 |
| Enterprise | 100 | 50 |

## Endpoints (auth)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/forms` | List templates của tenant |
| `POST` | `/v1/forms` | Tạo template |
| `PATCH` | `/v1/forms/:id` | Update (name/description/fields/active/eventId) |
| `DELETE` | `/v1/forms/:id` | Xóa |
| `GET` | `/v1/forms/by-event/:eventId` | Resolve template cho event |
| `GET` | `/v1/forms/:id/schema` | Export JSON Schema (draft-07 style) |

## Endpoints (public, no auth)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/public/forms/by-event/:tenantId/:eventId` | Public form + JSON Schema |
| `POST` | `/public/forms/by-event/:tenantId/:eventId/validate` | Server-side validation |

## Storage

`apps/core-api/src/SaasCheckin.EntityFrameworkCore/.../RegistrationConfiguration.cs` thêm
column `custom_field_values JSONB` (Phase 10 migration). Phase 9 BFF giữ
template definitions in-memory, trả validated payload để controller khác persist.

## Dynamic form rendering (Next.js)

```ts
// apps/web/src/modules/public-registration/components/DynamicForm.tsx
import { RJSFSchema } from "@rjsf/utils";
import Form from "@rjsf/mui";

const schema = (await fetch(`/public/forms/by-event/${tenantId}/${eventId}`)).json().jsonSchema;
const uiSchema = { "ui:submitButtonOptions": { norender: true } };
return <Form schema={schema} uiSchema={uiSchema} onSubmit={onSubmit} />;
```

(RJSF dùng làm reference — Phase 9 cần verify license OK với repo. Nếu không,
tự build dynamic form 8 fields × react-hook-form + zod dynamic schema.)

## Future (Phase 10+)

- `File` field type (S3 presigned upload)
- Conditional logic (show field B nếu field A = "other")
- Multi-page form (wizard)
- Section/heading fields (purely UI)
