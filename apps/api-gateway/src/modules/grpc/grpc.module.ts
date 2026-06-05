/**
 * apps/api-gateway/src/modules/grpc/grpc.module.ts
 *
 * Phase 1: chỉ export IDENTITY_GRPC client singleton.
 * Future: thêm PlatformGrpcClient (BYPASSRLS channel) ở I-107.
 */
import { Global, Module, type Provider } from "@nestjs/common";
import type { Client } from "@grpc/grpc-js";
import { getIdentityGrpcClient } from "./grpc-core-client";

export const IDENTITY_GRPC = "IDENTITY_GRPC";

const identityProvider: Provider = {
  provide: IDENTITY_GRPC,
  useFactory: (): Client => getIdentityGrpcClient(),
};

@Global()
@Module({
  providers: [identityProvider],
  exports: [IDENTITY_GRPC],
})
export class GrpcModule {}
