/**
 * apps/web/src/modules/qr/storage/s3-qr-storage.ts
 *
 * S3/MinIO upload. Pure fetch — không pull AWS SDK vào api-gateway bundle
 * (giữ image gọn). Presigned URL generation đã làm ở S3 side; ở đây chỉ PUT.
 */
import { Logger } from "@nestjs/common";

export class S3QrStorage {
  private readonly logger = new Logger(S3QrStorage.name);
  private readonly bucket = process.env.S3_BUCKET ?? "saas-checkin-qr";
  private readonly region = process.env.S3_REGION ?? "us-east-1";
  private readonly endpoint = process.env.S3_ENDPOINT; // for MinIO

  async put(organizationId: string, registrationId: string, png: Buffer): Promise<string> {
    const key = `qr/${organizationId}/${registrationId}.png`;
    const url = this.endpoint
      ? `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        "x-amz-acl": "public-read",
      },
      body: png,
    });
    if (!res.ok) {
      throw new Error(`S3 PUT failed: ${res.status} ${await res.text()}`);
    }
    this.logger.log(`Uploaded ${key} (${png.length} bytes)`);
    return this.publicUrl(key);
  }

  private publicUrl(key: string): string {
    return this.endpoint
      ? `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
