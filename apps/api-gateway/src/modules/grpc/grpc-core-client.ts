/**
 * apps/api-gateway/src/modules/grpc/grpc-core-client.ts
 *
 * Singleton gRPC channel + low-level RPC helpers tới core-api IdentityService.
 *
 * Phase 1 implementation:
 *  - .NET side binds gRPC methods manually (IdentityServiceBase.BindService()),
 *    using identity-marshallers (raw bytes, no proto descriptor).
 *  - BFF side dùng raw `Channel.makeUnaryRequest` với custom method path +
 *    identity serializer/deserializer. KHÔNG dùng proto-loaded ServiceClient
 *    vì các RPC mới (SignInUser, RefreshUser, v.v.) chưa có trong identity.proto.
 *  - Request body = JSON-serialized; response body = JSON-deserialized.
 *
 * Phase 1+2 (I-105): thay bằng proto-generated stubs khi buf generate chạy.
 */
import {
  credentials,
  Metadata,
  type ChannelCredentials,
  type Client,
} from "@grpc/grpc-js";

const CORE_API_URL = process.env.CORE_API_GRPC_URL ?? "localhost:50051";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    const { Client: GrpcClient } = require("@grpc/grpc-js") as {
      Client: new (address: string, creds: ChannelCredentials) => Client;
    };
    _client = new GrpcClient(CORE_API_URL, credentials.createInsecure());
  }
  return _client;
}

export function getIdentityGrpcClient(): Client {
  return getClient();
}

export { Metadata };

/**
 * Append X-Tenant-Id metadata từ JWT claim. Core API CurrentTenantMiddleware
 * đọc header này → set ICurrentTenant → EF RLS interceptor set
 * app.current_tenant trên connection.
 */
export function tenantMetadata(tenantId: string | undefined): Metadata {
  const md = new Metadata();
  if (tenantId) md.add("x-tenant-id", tenantId);
  return md;
}

/** gRPC method path cho IdentityService RPCs. */
export const IdentityMethod = {
  SignInUser: "/saascheckin.identity.v1.IdentityService/SignInUser",
  RefreshUser: "/saascheckin.identity.v1.IdentityService/RefreshUser",
  LogoutUser: "/saascheckin.identity.v1.IdentityService/LogoutUser",
  RegisterUser: "/saascheckin.identity.v1.IdentityService/RegisterUser",
  GetUser: "/saascheckin.identity.v1.IdentityService/GetUser",
  ResolveUser: "/saascheckin.identity.v1.IdentityService/ResolveUser",
} as const;

/**
 * JSON-over-gRPC call: serialize request → bytes → bytes → parse JSON response.
 * Match .NET IdentityServiceBase marshaller behavior.
 */
export function unary<TRequest, TResponse>(
  method: string,
  request: TRequest,
  metadata: Metadata = new Metadata(),
): Promise<TResponse> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    client.makeUnaryRequest<TRequest, TResponse>(
      method,
      (val: TRequest) => Buffer.from(JSON.stringify(val), "utf8"),
      (buf: Buffer) => JSON.parse(buf.toString("utf8")) as TResponse,
      request,
      metadata,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response as TResponse);
      },
    );
  });
}
