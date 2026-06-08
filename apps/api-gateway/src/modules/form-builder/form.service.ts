/**
 * apps/api-gateway/src/modules/form-builder/form.service.ts
 *
 * I-903 — Service layer: CRUD + submission validation + JSON schema export.
 * Forward gRPC registration submission sang core-api trong Phase 10+
 * (hiện tại return validated payload để BFF controller persist).
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InMemoryFormTemplateStore } from "./form-template.store";
import {
  schemaToJsonSchema,
  validateSubmission,
  validateTemplate,
} from "./form-validator";
import type {
  FormTemplate,
  FormTemplateInput,
  FormTemplateUpdate,
} from "./form.types";
import { FORM_PLAN_QUOTAS } from "./form.types";

@Injectable()
export class FormService {
  private readonly logger = new Logger(FormService.name);

  // Inject the concrete class (not the IFormTemplateStore interface) so Nest's
  // runtime DI can resolve the token via reflect-metadata. Interfaces are
  // erased at compile time, so `private readonly store: IFormTemplateStore`
  // would surface as `Object` to the injector and fail with
  // UnknownDependenciesException. The interface is still useful as a contract
  // for test mocks; we just don't put it on the wire here.
  constructor(private readonly store: InMemoryFormTemplateStore) {}

  async list(tenantId: string): Promise<FormTemplate[]> {
    return this.store.listByTenant(tenantId);
  }

  async create(tenantId: string, input: FormTemplateInput, plan: string): Promise<FormTemplate> {
    const validation = validateTemplate(input, plan);
    if (!validation.ok) {
      throw new BadRequestException({ message: "validation failed", errors: validation.errors });
    }
    const quota = FORM_PLAN_QUOTAS[plan] ?? FORM_PLAN_QUOTAS.free;
    const existing = await this.store.listByTenant(tenantId);
    if (existing.length >= quota.maxTemplates) {
      throw new BadRequestException(
        `plan ${plan} reached form template quota (${quota.maxTemplates})`,
      );
    }
    return this.store.create(tenantId, input);
  }

  async update(
    id: string,
    tenantId: string,
    patch: FormTemplateUpdate,
    plan: string,
  ): Promise<FormTemplate> {
    const existing = await this.store.get(id);
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException("template not found");
    }
    if (patch.fields !== undefined) {
      const validation = validateTemplate(
        {
          name: patch.name ?? existing.name,
          description: patch.description ?? existing.description,
          fields: patch.fields,
          eventId: patch.eventId ?? existing.eventId,
        },
        plan,
      );
      if (!validation.ok) {
        throw new BadRequestException({ message: "validation failed", errors: validation.errors });
      }
    }
    const updated = await this.store.update(id, tenantId, patch);
    if (!updated) throw new NotFoundException("template not found");
    return updated;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const ok = await this.store.delete(id, tenantId);
    if (!ok) throw new NotFoundException("template not found");
  }

  async getByEvent(tenantId: string, eventId: string): Promise<FormTemplate> {
    const t = await this.store.getByEvent(tenantId, eventId);
    if (!t) throw new NotFoundException("no form for event");
    return t;
  }

  async exportJsonSchema(id: string, tenantId: string): Promise<ReturnType<typeof schemaToJsonSchema>> {
    const t = await this.store.get(id);
    if (!t || t.tenantId !== tenantId) throw new NotFoundException("template not found");
    return schemaToJsonSchema(t);
  }

  /** Public endpoint — no auth, no plan check. Used by attendee registration form. */
  async getPublicByEvent(
    tenantId: string,
    eventId: string,
  ): Promise<{ template: FormTemplate; jsonSchema: ReturnType<typeof schemaToJsonSchema> } | null> {
    const t = await this.store.getByEvent(tenantId, eventId);
    if (!t || !t.active) return null;
    return { template: t, jsonSchema: schemaToJsonSchema(t) };
  }

  /** Validate submission ở server-side khi attendee submit form. */
  validatePayload(
    template: FormTemplate,
    values: Record<string, unknown>,
  ): { ok: boolean; errors: Record<string, string> } {
    return validateSubmission(template, values);
  }
}

export const _Store = InMemoryFormTemplateStore;
