/**
 * apps/api-gateway/src/modules/form-builder/form-builder.spec.ts
 *
 * I-903 — Validator + service tests.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryFormTemplateStore } from "./form-template.store";
import { FormService } from "./form.service";
import {
  schemaToJsonSchema,
  validateSubmission,
  validateTemplate,
} from "./form-validator";
import type { FormField, FormTemplate } from "./form.types";

const tenant = (i = 0) => `tenant_${i + 1}`;

describe("validateTemplate", () => {
  it("accepts a valid text field", () => {
    const r = validateTemplate(
      { name: "T-shirt size", fields: [{ key: "size", type: "text", label: "Size", required: true, order: 0 }] },
      "pro",
    );
    expect(r.ok).toBe(true);
  });

  it("rejects invalid key (uppercase)", () => {
    const r = validateTemplate(
      { name: "T", fields: [{ key: "Size", type: "text", label: "Size", required: true, order: 0 }] },
      "pro",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects reserved key", () => {
    const r = validateTemplate(
      { name: "T", fields: [{ key: "email", type: "text", label: "E", required: true, order: 0 }] },
      "pro",
    );
    expect(r.ok).toBe(false);
    expect((r as { errors: string[] }).errors.join(" ")).toMatch(/reserved/);
  });

  it("rejects select without options", () => {
    const r = validateTemplate(
      { name: "T", fields: [{ key: "color", type: "select", label: "Color", required: true, order: 0 }] },
      "pro",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects options for non-select", () => {
    const r = validateTemplate(
      {
        name: "T",
        fields: [{ key: "color", type: "text", label: "Color", required: true, order: 0, options: ["a"] }],
      },
      "pro",
    );
    expect(r.ok).toBe(false);
  });

  it("enforces plan quota for free (max 5 fields)", () => {
    const fields: FormField[] = Array.from({ length: 6 }, (_, i) => ({
      key: `f${i}`,
      type: "text",
      label: `F${i}`,
      required: false,
      order: i,
    }));
    const r = validateTemplate({ name: "Big", fields }, "free");
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate keys", () => {
    const r = validateTemplate(
      {
        name: "Dup",
        fields: [
          { key: "color", type: "text", label: "A", required: false, order: 0 },
          { key: "color", type: "text", label: "B", required: false, order: 1 },
        ],
      },
      "pro",
    );
    expect(r.ok).toBe(false);
    expect((r as { errors: string[] }).errors.join(" ")).toMatch(/duplicate/);
  });

  it("rejects invalid regex pattern", () => {
    const r = validateTemplate(
      {
        name: "Bad",
        fields: [
          {
            key: "code",
            type: "text",
            label: "Code",
            required: false,
            order: 0,
            validation: { pattern: "[unclosed" },
          },
        ],
      },
      "pro",
    );
    expect(r.ok).toBe(false);
    expect((r as { errors: string[] }).errors.join(" ")).toMatch(/regex/);
  });
});

describe("validateSubmission", () => {
  const tpl: FormTemplate = {
    id: "t1", tenantId: "x", name: "Demo", active: true, createdAt: "", updatedAt: "",
    fields: [
      { key: "name", type: "text", label: "Name", required: true, order: 0, validation: { minLength: 2 } },
      { key: "color", type: "select", label: "Color", required: true, order: 1, options: ["red", "blue"] },
      { key: "age", type: "number", label: "Age", required: false, order: 2, validation: { min: 0, max: 150 } },
      { key: "agree", type: "checkbox", label: "Agree", required: true, order: 3 },
      { key: "email", type: "email", label: "Email", required: false, order: 4 },
    ],
  };

  it("accepts a valid submission", () => {
    const r = validateSubmission(tpl, { name: "Alice", color: "red", agree: true, email: "a@b.com" });
    expect(r.ok).toBe(true);
  });

  it("rejects missing required", () => {
    const r = validateSubmission(tpl, { name: "Alice", color: "red" });
    expect(r.ok).toBe(false);
    expect(r.errors.agree).toBe("required");
  });

  it("rejects out-of-range number", () => {
    const r = validateSubmission(tpl, { name: "Alice", color: "red", agree: true, age: 200 });
    expect(r.ok).toBe(false);
    expect(r.errors.age).toMatch(/max 150/);
  });

  it("rejects invalid email", () => {
    const r = validateSubmission(tpl, { name: "Alice", color: "red", agree: true, email: "not-an-email" });
    expect(r.ok).toBe(false);
    expect(r.errors.email).toBe("invalid email");
  });

  it("rejects select value not in options", () => {
    const r = validateSubmission(tpl, { name: "Alice", color: "neon", agree: true });
    expect(r.ok).toBe(false);
    expect(r.errors.color).toMatch(/one of/);
  });

  it("rejects short string", () => {
    const r = validateSubmission(tpl, { name: "A", color: "red", agree: true });
    expect(r.ok).toBe(false);
    expect(r.errors.name).toMatch(/min length 2/);
  });
});

describe("schemaToJsonSchema", () => {
  it("emits JSON Schema draft-07 style", () => {
    const tpl: FormTemplate = {
      id: "t1", tenantId: "x", name: "Demo", active: true, createdAt: "", updatedAt: "",
      fields: [
        { key: "email", type: "email", label: "Email", required: true, order: 0 },
        { key: "age", type: "number", label: "Age", required: false, order: 1, validation: { min: 18 } },
        { key: "colors", type: "select", label: "Colors", required: true, order: 2, options: ["red", "blue"], multiple: true },
        { key: "agree", type: "checkbox", label: "Agree", required: false, order: 3 },
      ],
    };
    const schema = schemaToJsonSchema(tpl);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["email", "colors"]);
    const p = schema.properties as Record<string, Record<string, unknown>>;
    expect(p.email.type).toBe("string");
    expect(p.email.format).toBe("email");
    expect(p.age.type).toBe("number");
    expect(p.age.minimum).toBe(18);
    expect(p.colors.type).toBe("array");
    expect((p.colors.items as Record<string, unknown>).enum).toEqual(["red", "blue"]);
    expect(p.agree.type).toBe("boolean");
  });

  it("sorts fields by order in schema output", () => {
    const tpl: FormTemplate = {
      id: "t1", tenantId: "x", name: "Demo", active: true, createdAt: "", updatedAt: "",
      fields: [
        { key: "b", type: "text", label: "B", required: false, order: 2 },
        { key: "a", type: "text", label: "A", required: false, order: 1 },
      ],
    };
    const schema = schemaToJsonSchema(tpl);
    const keys = Object.keys(schema.properties as Record<string, unknown>);
    expect(keys).toEqual(["a", "b"]);
  });
});

describe("FormService", () => {
  let store: InMemoryFormTemplateStore;
  let service: FormService;

  beforeEach(() => {
    store = new InMemoryFormTemplateStore();
    service = new FormService(store);
  });

  it("creates and lists", async () => {
    const tpl = await service.create(
      tenant(),
      { name: "T1", fields: [{ key: "x", type: "text", label: "X", required: true, order: 0 }] },
      "pro",
    );
    expect(tpl.id).toBeTruthy();
    const list = await service.list(tenant());
    expect(list).toHaveLength(1);
  });

  it("enforces plan template quota (free: 1)", async () => {
    await service.create(
      tenant(),
      { name: "T1", fields: [{ key: "x", type: "text", label: "X", required: true, order: 0 }] },
      "free",
    );
    await expect(
      service.create(
        tenant(),
        { name: "T2", fields: [{ key: "y", type: "text", label: "Y", required: true, order: 0 }] },
        "free",
      ),
    ).rejects.toThrow(/quota/);
  });

  it("updates fields", async () => {
    const tpl = await service.create(
      tenant(),
      { name: "T1", fields: [{ key: "x", type: "text", label: "X", required: true, order: 0 }] },
      "pro",
    );
    const updated = await service.update(
      tpl.id,
      tenant(),
      { name: "Renamed", active: false },
      "pro",
    );
    expect(updated.name).toBe("Renamed");
    expect(updated.active).toBe(false);
  });

  it("rejects invalid update", async () => {
    const tpl = await service.create(
      tenant(),
      { name: "T1", fields: [{ key: "x", type: "text", label: "X", required: true, order: 0 }] },
      "pro",
    );
    await expect(
      service.update(tpl.id, tenant(), { fields: [] }, "pro"),
    ).rejects.toThrow(/validation/);
  });

  it("rejects update from wrong tenant", async () => {
    const tpl = await service.create(
      tenant(),
      { name: "T1", fields: [{ key: "x", type: "text", label: "X", required: true, order: 0 }] },
      "pro",
    );
    await expect(
      service.update(tpl.id, "other_tenant", { name: "Hack" }, "pro"),
    ).rejects.toThrow(/not found/);
  });

  it("exports JSON schema for tenant template", async () => {
    const tpl = await service.create(
      tenant(),
      {
        name: "T1",
        fields: [{ key: "contact_email", type: "email", label: "Email", required: true, order: 0 }],
      },
      "pro",
    );
    const schema = await service.exportJsonSchema(tpl.id, tenant());
    expect(schema.type).toBe("object");
  });

  it("getByEvent returns template + schema", async () => {
    await service.create(
      tenant(),
      {
        name: "Reg",
        eventId: "evt_1",
        fields: [{ key: "diet", type: "text", label: "Diet", required: false, order: 0 }],
      },
      "pro",
    );
    const result = await service.getPublicByEvent(tenant(), "evt_1");
    expect(result).not.toBeNull();
    expect(result?.template.eventId).toBe("evt_1");
    expect(result?.jsonSchema.properties).toHaveProperty("diet");
  });

  it("getByEvent returns null when inactive", async () => {
    const tpl = await service.create(
      tenant(),
      {
        name: "Reg",
        eventId: "evt_1",
        fields: [{ key: "diet", type: "text", label: "Diet", required: false, order: 0 }],
      },
      "pro",
    );
    await service.update(tpl.id, tenant(), { active: false }, "pro");
    const result = await service.getPublicByEvent(tenant(), "evt_1");
    expect(result).toBeNull();
  });

  it("validatePayload returns errors per key", async () => {
    await service.create(
      tenant(),
      {
        name: "T",
        eventId: "evt_2",
        fields: [
          { key: "full_name", type: "text", label: "Name", required: true, order: 0, validation: { minLength: 2 } },
        ],
      },
      "pro",
    );
    const tpl = await service.getByEvent(tenant(), "evt_2");
    const r = service.validatePayload(tpl, { full_name: "A" });
    expect(r.ok).toBe(false);
    expect(r.errors.full_name).toMatch(/min length 2/);
  });
});
