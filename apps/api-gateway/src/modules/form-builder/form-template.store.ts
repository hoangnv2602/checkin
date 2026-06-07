/**
 * apps/api-gateway/src/modules/form-builder/form-template.store.ts
 *
 * I-903 — In-memory store. Phase 10+ swap sang Postgres `form_templates`
 * (jsonb schema) + `form_field_values` (jsonb ở registrations).
 */
import { Injectable, Logger } from "@nestjs/common";
import type {
  FormTemplate,
  FormTemplateInput,
  FormTemplateUpdate,
} from "./form.types";

export interface IFormTemplateStore {
  listByTenant(tenantId: string): Promise<FormTemplate[]>;
  get(id: string): Promise<FormTemplate | null>;
  getByEvent(tenantId: string, eventId: string): Promise<FormTemplate | null>;
  create(tenantId: string, input: FormTemplateInput): Promise<FormTemplate>;
  update(id: string, tenantId: string, patch: FormTemplateUpdate): Promise<FormTemplate | null>;
  delete(id: string, tenantId: string): Promise<boolean>;
}

@Injectable()
export class InMemoryFormTemplateStore implements IFormTemplateStore {
  private readonly logger = new Logger(InMemoryFormTemplateStore.name);
  private readonly templates = new Map<string, FormTemplate>();
  private idCounter = 0;

  private nextId(): string {
    this.idCounter += 1;
    return `frm_${Date.now().toString(36)}_${this.idCounter.toString(36)}`;
  }

  async listByTenant(tenantId: string): Promise<FormTemplate[]> {
    return [...this.templates.values()].filter((t) => t.tenantId === tenantId);
  }

  async get(id: string): Promise<FormTemplate | null> {
    return this.templates.get(id) ?? null;
  }

  async getByEvent(tenantId: string, eventId: string): Promise<FormTemplate | null> {
    return [...this.templates.values()].find(
      (t) => t.tenantId === tenantId && t.eventId === eventId,
    ) ?? null;
  }

  async create(tenantId: string, input: FormTemplateInput): Promise<FormTemplate> {
    const now = new Date().toISOString();
    const tpl: FormTemplate = {
      id: this.nextId(),
      tenantId,
      name: input.name,
      description: input.description,
      fields: input.fields,
      eventId: input.eventId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.templates.set(tpl.id, tpl);
    this.logger.log(`template created ${tpl.id} tenant=${tenantId} fields=${input.fields.length}`);
    return tpl;
  }

  async update(id: string, tenantId: string, patch: FormTemplateUpdate): Promise<FormTemplate | null> {
    const existing = this.templates.get(id);
    if (!existing || existing.tenantId !== tenantId) return null;
    const updated: FormTemplate = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(id, updated);
    return updated;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = this.templates.get(id);
    if (!existing || existing.tenantId !== tenantId) return false;
    this.templates.delete(id);
    this.logger.log(`template deleted ${id} tenant=${tenantId}`);
    return true;
  }
}
