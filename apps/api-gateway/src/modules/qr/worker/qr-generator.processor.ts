/**
 * apps/api-gateway/src/modules/qr/worker/qr-generator.processor.ts
 *
 * I-304 — BullMQ worker. Trigger bởi TicketIssuedIntegrationEvent (publish
 * từ .NET core-api). Ở dev in-process bus (MediatR cùng process); production
 * MassTransit over Redis Streams.
 *
 * Flow:
 *  1. Render QR PNG + Ed25519 signature (QrRenderService)
 *  2. Upload S3/MinIO (LocalQrStorage fallback)
 *  3. PUT /v1/registration/registrations/{id} với qr_image_url + signature
 *  4. Acks job, retries 3x nếu fail, dead-letter queue nếu exhausted
 */
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QrRenderService } from "../service/qr-render.service";
import { readFile } from "node:fs/promises";

export const QR_GENERATE_QUEUE = "qr:generate";

export interface QrGenerateJobData {
  organizationId: string;
  registrationId: string;
  jti: string;
  expiresAt: string;
  /** Path to public key file (used for offline verify fingerprint). */
  publicKeyPath?: string;
}

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

@Processor(QR_GENERATE_QUEUE)
export class QrGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(QrGeneratorProcessor.name);

  constructor(private readonly renderer: QrRenderService) {
    super();
  }

  async process(job: Job<QrGenerateJobData>): Promise<{ qrImageUrl: string; bytes: number }> {
    const data = job.data;
    this.logger.log(`render QR for reg=${data.registrationId} jti=${data.jti}`);

    let publicKey = "";
    if (data.publicKeyPath) {
      try {
        publicKey = (await readFile(data.publicKeyPath, "utf-8")).trim();
      } catch {
        this.logger.warn(`public key not found at ${data.publicKeyPath}; using empty fingerprint`);
      }
    }

    const result = await this.renderer.render({
      organizationId: data.organizationId,
      registrationId: data.registrationId,
      jti: data.jti,
      expiresAt: data.expiresAt,
      signingPublicKey: publicKey,
    });

    // Persist to .NET core-api
    const res = await fetch(`${CORE_API_BASE}/v1/registration/registrations/${data.registrationId}/qr`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": data.organizationId,
      },
      body: JSON.stringify({
        organizationId: data.organizationId,
        qrImageUrl: result.qrImageUrl,
        signature: result.signature,
      }),
    });
    if (!res.ok) {
      throw new Error(`core-api attach QR failed: ${res.status} ${await res.text()}`);
    }

    return { qrImageUrl: result.qrImageUrl, bytes: result.bytes };
  }

  /** Optional: hook để enqueue từ controller / MediatR handler. */
  static queueName(): string {
    return QR_GENERATE_QUEUE;
  }
}
