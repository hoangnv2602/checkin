/**
 * apps/api-gateway/src/modules/grpc-server/grpc-server.config.ts
 *
 * I-801: gRPC server config for mobile clients.
 * Port 50052 (different from core-api:50051).
 */
import { GrpcOptions, Transport } from "@nestjs/microservices";
import { ReflectionService } from "@grpc/reflection";
import { join } from "node:path";

// Proto files are in the monorepo root at packages/proto/{checkin,ticketing,identity}/v1/*.proto.
// At runtime __dirname = apps/api-gateway/dist/src/modules/grpc-server/, so we need six
// levels up to reach the monorepo root, then into packages/proto.
const PROTO_ROOT = join(__dirname, "../../../../../../packages/proto");

export function grpcServerOptions(): GrpcOptions {
  return {
    transport: Transport.GRPC,
    options: {
      package: [
        "saascheckin.checkin.v1",
        "saas_checkin.ticketing.v1",
        "saascheckin.identity.v1",
      ],
      protoPath: [
        join(PROTO_ROOT, "checkin/v1/checkin.proto"),
        join(PROTO_ROOT, "ticketing/v1/ticketing.proto"),
        join(PROTO_ROOT, "identity/v1/identity.proto"),
      ],
      url: `0.0.0.0:${process.env.GRPC_SERVER_PORT ?? 50052}`,
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  };
}
