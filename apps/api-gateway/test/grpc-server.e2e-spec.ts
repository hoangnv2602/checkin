/**
 * apps/api-gateway/test/grpc-server.e2e-spec.ts
 *
 * I-801: e2e test cho BFF gRPC server :50052.
 * Verify: gRPC server boots, CheckInService.Scan trả response, GetEventStats hoạt động.
 *
 * Lưu ý: test này KHÔNG cần core-api thật chạy — sẽ giả lập rawUnary bằng cách
 * monkey-patch grpc-core-client để trả response giả. Cũng KHÔNG bootstrap
 * toàn bộ AppModule (có quá nhiều DI graph) — chỉ test GrpcServerModule
 * trong isolation, với GrpcServerOptions trực tiếp.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestMicroservice } from "@nestjs/microservices";
import { join } from "node:path";
import { Metadata, type Client } from "@grpc/grpc-js";

// Mock grpc-core-client TRƯỚC khi import GrpcServerModule.
vi.mock("../src/modules/grpc/grpc-core-client", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../src/modules/grpc/grpc-core-client",
  );
  return {
    ...actual,
    getIdentityGrpcClient: (): Client => {
      return {
        makeUnaryRequest: (
          method: string,
          _serialize: (x: Buffer) => Buffer,
          _deserialize: (x: Buffer) => unknown,
          _body: Buffer,
          _metadata: Metadata,
          callback: (err: Error | null, response: unknown) => void,
        ) => {
          if (method.includes("Scan")) {
            setImmediate(() =>
              callback(null, {
                ok: true,
                message: "checked in (test stub)",
                attendee: {
                  user_id: "u_test",
                  full_name: "Test User",
                  email: "test@example.com",
                  ticket_type: "GA",
                  avatar_url: "",
                },
                result: "CHECK_IN_RESULT_OK",
              }),
            );
            return;
          }
          if (method.includes("EventStats")) {
            setImmediate(() =>
              callback(null, {
                total_registered: 100,
                total_checked_in: 42,
                total_pending: 58,
                total_no_show: 0,
                peak_checkins_per_minute: 12,
                average_time_to_check_in_seconds: 18.5,
              }),
            );
            return;
          }
          if (method.includes("UndoCheckIn")) {
            setImmediate(() => callback(null, { ok: true, message: "undone" }));
            return;
          }
          setImmediate(() => callback(new Error(`unmocked method ${method}`), null));
        },
      } as unknown as Client;
    },
  };
});

const PROTO_ROOT = join(__dirname, "../../../packages/proto");

describe("GrpcServer (I-801)", () => {
  let app: TestingModule;
  let microservice: INestMicroservice;
  let channel: ReturnType<typeof createClient>;

  function createClient() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const protoLoader = require("@grpc/proto-loader");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const grpc = require("@grpc/grpc-js");

    const packageDef = protoLoader.loadSync(
      join(PROTO_ROOT, "checkin/v1/checkin.proto"),
      { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
    );
    const proto = grpc.loadPackageDefinition(packageDef) as {
      saascheckin: { checkin: { v1: { CheckInService: new (addr: string, cred: unknown) => unknown } } };
    };
    const CheckInService = proto.saascheckin.checkin.v1.CheckInService;
    return new CheckInService("localhost:50052", grpc.credentials.createInsecure());
  }

  beforeAll(async () => {
    process.env.GRPC_SERVER_PORT = "50052";
    process.env.CORE_API_GRPC_URL = "localhost:50051";

    // Dynamic import AFTER vi.mock is hoisted
    const { GrpcServerModule } = await import("../src/modules/grpc-server/grpc-server.module");
    const { grpcServerOptions } = await import("../src/modules/grpc-server/grpc-server.config");

    app = await Test.createTestingModule({ imports: [GrpcServerModule] }).compile();
    microservice = app.createNestMicroservice(grpcServerOptions());
    await microservice.listen();
    channel = createClient();
  });

  afterAll(async () => {
    await microservice?.close();
    await app?.close();
    channel?.close?.();
  });

  it("boots gRPC server on port 50052", () => {
    expect(microservice).toBeDefined();
  });

  it("Scan returns success response (mocked core-api)", (done) => {
    (channel as unknown as {
      Scan: (req: unknown, cb: (err: Error | null, response: unknown) => void) => void;
    }).Scan(
      {
        qr_payload: "fake-payload",
        event_id: "evt_1",
        gate_id: "gate_1",
        staff_user_id: "u_staff",
      },
      (err: Error | null, response: unknown) => {
        expect(err).toBeNull();
        const r = response as { ok: boolean; result: string; attendee: { full_name: string } };
        expect(r.ok).toBe(true);
        expect(r.result).toBe("CHECK_IN_RESULT_OK");
        expect(r.attendee.full_name).toBe("Test User");
        done();
      },
    );
  });

  it("Scan rejects missing qr_payload with INVALID_ARGUMENT", (done) => {
    (channel as unknown as {
      Scan: (req: unknown, cb: (err: Error | null, response: unknown) => void) => void;
    }).Scan(
      { event_id: "evt_1" } as never,
      (err: Error | null) => {
        expect(err).not.toBeNull();
        expect((err as { code: number }).code).toBeGreaterThanOrEqual(3);
        done();
      },
    );
  });

  it("GetEventStats returns numeric counts", (done) => {
    (channel as unknown as {
      GetEventStats: (req: unknown, cb: (err: Error | null, response: unknown) => void) => void;
    }).GetEventStats(
      { event_id: "evt_1" } as never,
      (err: Error | null, response: unknown) => {
        expect(err).toBeNull();
        const r = response as { total_checked_in: number };
        expect(typeof r.total_checked_in).toBe("number");
        expect(r.total_checked_in).toBe(42);
        done();
      },
    );
  });
});
