/**
 * apps/api-gateway/test/form-builder/form-builder.di.e2e-spec.ts
 *
 * Regression test for the FormService DI error:
 *   UnknownDependenciesException: Nest can't resolve dependencies of the
 *   FormService (?). The argument at index [0] is unavailable in the
 *   current module.
 *
 * Root cause: FormService used `import { type IFormTemplateStore }` for
 * its constructor param. TypeScript erases interfaces at compile time, so
 * the reflect-metadata `design:paramtypes[0]` resolved to `Object` at
 * runtime and NestJS looked up a provider keyed `Object` (which doesn't
 * exist).
 *
 * Fix: inject the concrete `InMemoryFormTemplateStore` class (which IS
 * already registered in FormBuilderModule.providers).
 */
import { describe, it, expect } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { FormBuilderModule } from "../../src/modules/form-builder/form.module";
import { FormService } from "../../src/modules/form-builder/form.service";
import { InMemoryFormTemplateStore } from "../../src/modules/form-builder/form-template.store";

describe("FormBuilderModule DI graph", () => {
  it("boots FormBuilderModule and resolves FormService + InMemoryFormTemplateStore", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [FormBuilderModule],
    }).compile();

    const formService = moduleRef.get(FormService);
    const store = moduleRef.get(InMemoryFormTemplateStore);

    expect(formService).toBeInstanceOf(FormService);
    expect(store).toBeInstanceOf(InMemoryFormTemplateStore);
  });
});
