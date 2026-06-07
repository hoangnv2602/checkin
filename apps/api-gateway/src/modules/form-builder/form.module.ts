/**
 * apps/api-gateway/src/modules/form-builder/form.module.ts
 *
 * I-903 — Module composition: FormController (auth) + FormPublicController
 * + FormService + InMemoryFormTemplateStore.
 */
import { Module } from "@nestjs/common";
import { FormController, FormPublicController } from "./form.controller";
import { FormService } from "./form.service";
import { InMemoryFormTemplateStore } from "./form-template.store";

@Module({
  controllers: [FormController, FormPublicController],
  providers: [InMemoryFormTemplateStore, FormService],
  exports: [FormService, InMemoryFormTemplateStore],
})
export class FormBuilderModule {}
