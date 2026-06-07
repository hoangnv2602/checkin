/**
 * apps/api-gateway/src/modules/qr/storage/local-qr-storage.ts
 *
 * Dev fallback: write file vào /var/lib/saas-checkin/qr/{tenant}/{regId}.png
 * hoặc dùng data: URL nếu không ghi được.
 */
import { Injectable, Logger } from "@nestjs/common";

const ROOT = process.env.LOCAL_QR_DIR ?? "/var/lib/saas-checkin/qr";

@Injectable()
export class LocalQrStorage {
  private readonly logger = new Logger(LocalQrStorage.name);

  async put(organizationId: string, registrationId: string, png: Buffer): Promise<string> {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const dir = path.join(ROOT, organizationId);
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${registrationId}.png`);
      await fs.writeFile(file, png);
      return `file://${file}`;
    } catch (err) {
      this.logger.warn(`Local QR storage failed: ${err}; falling back to data URL`);
      return `data:image/png;base64,${png.toString("base64")}`;
    }
  }
}
