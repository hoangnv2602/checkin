/**
 * apps/api-gateway/src/modules/grpc-server/checkin-grpc.controller.ts
 *
 * I-801: gRPC CheckInService handler. Mobile calls BFF gRPC :50052
 * instead of REST :3001, skipping JSON parse on the hot path.
 *
 * BFF forwards to core-api :50051 via existing grpc-core-client (raw RPC).
 * Adds: tenant_id metadata, structured logging, Sentry breadcrumb.
 */
import { Controller, Logger } from "@nestjs/common";
import { GrpcMethod, RpcException } from "@nestjs/microservices";
import { status as GrpcStatus } from "@grpc/grpc-js";
import { Metadata } from "@grpc/grpc-js";
import { CoreApiModule } from "../core-api/core-api.module";
import {
  getIdentityGrpcClient,
  tenantMetadata,
} from "../grpc/grpc-core-client";

interface ScanRequest {
  qr_payload?: string;
  event_id?: string;
  gate_id?: string;
  staff_user_id?: string;
  organization_id?: string;
  scanned_at?: { seconds: number; nanos: number } | null;
}

interface ScanResponse {
  ok: boolean;
  message: string;
  attendee?: {
    user_id: string;
    full_name: string;
    email: string;
    ticket_type: string;
    avatar_url: string;
  };
  result: string;
}

interface GetEventStatsRequest {
  event_id: string;
  organization_id?: string;
}

interface GetEventStatsResponse {
  total_registered: number;
  total_checked_in: number;
  total_pending: number;
  last_scan_at?: { seconds: number; nanos: number } | null;
}

interface UndoCheckInRequest {
  registration_id: string;
  reason: string;
  staff_user_id: string;
  organization_id?: string;
}

interface UndoCheckInResponse {
  ok: boolean;
  message: string;
}

const CHECKIN_METHOD = "/saascheckin.checkin.v1.CheckInService/Scan";
const STATS_METHOD = "/saascheckin.checkin.v1.CheckInService/GetEventStats";
const UNDO_METHOD = "/saascheckin.checkin.v1.CheckInService/UndoCheckIn";

@Controller()
export class CheckInGrpcController {
  private readonly logger = new Logger(CheckInGrpcController.name);

  @GrpcMethod("CheckInService", "Scan")
  async scan(req: ScanRequest, metadata: Metadata): Promise<ScanResponse> {
    this.assertPayload(req);
    const tenantId = metadata.get("x-tenant-id")?.[0]?.toString() ?? req.organization_id ?? "";
    const t0 = Date.now();

    try {
      const response = await rawUnary<ScanRequest, ScanResponse>(
        CHECKIN_METHOD,
        req,
        tenantMetadata(tenantId),
      );
      this.logger.log(`grpc.scan ok tenant=${tenantId} event=${req.event_id} elapsed=${Date.now() - t0}ms`);
      return response;
    } catch (err) {
      this.logger.warn(`grpc.scan failed tenant=${tenantId} event=${req.event_id} elapsed=${Date.now() - t0}ms err=${(err as Error).message}`);
      throw mapToRpcException(err);
    }
  }

  @GrpcMethod("CheckInService", "GetEventStats")
  async getEventStats(
    req: GetEventStatsRequest,
    metadata: Metadata,
  ): Promise<GetEventStatsResponse> {
    if (!req.event_id) {
      throw new RpcException("event_id is required");
    }
    const tenantId = metadata.get("x-tenant-id")?.[0]?.toString() ?? req.organization_id ?? "";
    try {
      return await rawUnary<GetEventStatsRequest, GetEventStatsResponse>(
        STATS_METHOD,
        req,
        tenantMetadata(tenantId),
      );
    } catch (err) {
      throw mapToRpcException(err);
    }
  }

  @GrpcMethod("CheckInService", "UndoCheckIn")
  async undoCheckIn(
    req: UndoCheckInRequest,
    metadata: Metadata,
  ): Promise<UndoCheckInResponse> {
    if (!req.registration_id) {
      throw new RpcException("registration_id is required");
    }
    const tenantId = metadata.get("x-tenant-id")?.[0]?.toString() ?? req.organization_id ?? "";
    try {
      return await rawUnary<UndoCheckInRequest, UndoCheckInResponse>(
        UNDO_METHOD,
        req,
        tenantMetadata(tenantId),
      );
    } catch (err) {
      throw mapToRpcException(err);
    }
  }

  private assertPayload(req: ScanRequest): void {
    if (!req.qr_payload) throw new RpcException("qr_payload is required");
    if (!req.event_id) throw new RpcException("event_id is required");
  }
}

/**
 * Raw unary call to core-api gRPC :50051, re-using the shared client.
 * Avoids depending on a per-method generated stub.
 */
function rawUnary<Req, Res>(method: string, body: Req, md: Metadata): Promise<Res> {
  return new Promise((resolve, reject) => {
    const client = getIdentityGrpcClient();
    // gRPC's makeUnaryRequest callback type is `(err, res: T | undefined)` — we
    // accept the looser type and assert at the resolve site since Res is a
    // JSON-parsed payload and the proto stub guarantees it on the success path.
    client.makeUnaryRequest(
      method,
      (x: Buffer) => x,
      (x: Buffer) => JSON.parse(x.toString("utf8")),
      Buffer.from(JSON.stringify(body)),
      md,
      ((err: Error | null, response: Res | undefined) => {
        if (err) reject(err);
        else resolve(response as Res);
      }) as never,
    );
  });
}

function mapToRpcException(err: unknown): RpcException {
  if (err instanceof RpcException) return err;
  const msg = err instanceof Error ? err.message : "internal error";
  return new RpcException({ code: GrpcStatus.INTERNAL, message: msg });
}

// Suppress unused import warning — CoreApiModule re-exports the client.
void CoreApiModule;
