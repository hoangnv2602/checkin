/**
 * apps/api-gateway/src/modules/grpc-server/grpc-server.config.ts
 *
 * I-801: gRPC server config for mobile clients.
 * Port 50052 (different from core-api:50051).
 */
import { existsSync } from "node:fs";
import { GrpcOptions, Transport } from "@nestjs/microservices";
import { ReflectionService } from "@grpc/reflection";
import { join, resolve } from "node:path";

/**
 * Resolve PROTO_ROOT robustly across dev (vitest), build (nest build → dist),
 * and runtime (node dist/main). Search upward for a `packages/proto` directory.
 */
function resolveProtoRoot(): string {
  const candidates = [
    // dev: apps/api-gateway/src/modules/grpc-server/grpc-server.config.ts
    resolve(__dirname, "..", "..", "..", "..", "..", "packages", "proto"),
    // build: apps/api-gateway/dist/src/modules/grpc-server/grpc-server.config.js
    resolve(__dirname, "..", "..", "..", "..", "..", "..", "packages", "proto"),
    // cwd-relative (in case of unusual launch)
    resolve(process.cwd(), "packages", "proto"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fallback: first candidate (build path), so the error message points to the most likely place.
  return candidates[1];
}

const PROTO_ROOT = resolveProtoRoot();

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
