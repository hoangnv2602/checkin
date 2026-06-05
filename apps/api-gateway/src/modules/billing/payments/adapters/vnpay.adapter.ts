/**
 * apps/api-gateway/src/modules/billing/payments/adapters/vnpay.adapter.ts
 *
 * I-302 — VNPay adapter. Implements PaymentProviderInterface for VNPay gateway.
 *
 * VNPay flow:
 *  1. BFF build redirect URL với params (vnp_Amount, vnp_TxnRef, vnp_SecureHash).
 *  2. User pays ở VNPay sandbox/production.
 *  3. VNPay IPN (server-to-server POST) gửi lại với vnp_SecureHash SHA512.
 *  4. BFF verify hash, nếu ok → MarkOrderPaid.
 *
 * Refs: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProviderInterface,
  VerifyWebhookInput,
  WebhookEvent,
} from "../payment-provider.interface";
import { Injectable, Logger } from "@nestjs/common";

const VNP_URL = process.env.VNP_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const VNP_TMN_CODE = process.env.VNP_TMN_CODE ?? "SANDBOX_TMN";
const VNP_HASH_SECRET = process.env.VNP_HASH_SECRET ?? "SANDBOX_HASH_SECRET";
const VNP_RETURN_URL = process.env.VNP_RETURN_URL ?? "http://localhost:3000/e/sandbox/register/success";

@Injectable()
export class VnpayAdapter implements PaymentProviderInterface {
  readonly name = "vnpay" as const;
  private readonly logger = new Logger(VnpayAdapter.name);

  isEnabledFor(_organizationId: string): Promise<boolean> {
    return Promise.resolve(Boolean(process.env.VNP_HASH_SECRET));
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const now = new Date();
    const vnpCreateDate = this.formatVnpDate(now);
    const vnpExpireDate = this.formatVnpDate(new Date(now.getTime() + 10 * 60 * 1000));

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: VNP_TMN_CODE,
      vnp_Amount: String(input.amountMinor * 100), // VNPay uses VND * 100
      vnp_CurrCode: input.currency,
      vnp_TxnRef: input.orderId,
      vnp_OrderInfo: input.description.slice(0, 255),
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: input.successUrl,
      vnp_IpAddr: "127.0.0.1",
      vnp_CreateDate: vnpCreateDate,
      vnp_ExpireDate: vnpExpireDate,
      vnp_BankCode: "",
    };

    const sortedKeys = Object.keys(params).sort();
    const signData = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
    const secureHash = createHmac("sha512", VNP_HASH_SECRET).update(signData).digest("hex");
    const queryString = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k] ?? "")}`).join("&");

    return {
      provider: "vnpay",
      sessionId: input.orderId,
      redirectUrl: `${VNP_URL}?${queryString}&vnp_SecureHash=${secureHash}`,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    };
  }

  verifyWebhook(input: VerifyWebhookInput): WebhookEvent | null {
    // VNPay IPN: query/form params in rawBody hoặc metadata.
    // Ưu tiên parse từ metadata (req.query) cho an toàn; rawBody chứa URL-encoded form.
    const meta = input.metadata ?? {};
    const secureHash = meta["vnp_SecureHash"];
    if (!secureHash) return null;

    const sortedKeys = Object.keys(meta)
      .filter((k) => k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType")
      .sort();
    const signData = sortedKeys.map((k) => `${k}=${meta[k]}`).join("&");
    const expected = createHmac("sha512", VNP_HASH_SECRET).update(signData).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(secureHash, "hex");
    if (expectedBuf.length !== providedBuf.length) return null;
    if (!timingSafeEqual(expectedBuf, providedBuf)) return null;

    const responseCode = meta["vnp_ResponseCode"];
    const transactionStatus = meta["vnp_TransactionStatus"];
    const orderId = meta["vnp_TxnRef"] ?? "";
    const type =
      transactionStatus === "00" || responseCode === "00"
        ? "ipn_paid"
        : "ipn_failed";
    return {
      provider: "vnpay",
      providerEventId: `${orderId}-${meta["vnp_PayDate"] ?? Date.now()}`,
      type,
      orderId,
      organizationId: meta["organizationId"] ?? "",
      amountMinor: Number(meta["vnp_Amount"] ?? 0) / 100,
      currency: meta["vnp_CurrCode"] ?? "VND",
      signatureValid: true,
      rawPayload: input.rawBody,
      receivedAt: new Date().toISOString(),
    };
  }

  async checkStatus(providerSessionId: string): Promise<{ status: "paid" | "pending" | "failed" | "expired" }> {
    // Phase 3: VNPay sandbox không có public status API ngoài IPN;
    // status check chủ yếu qua worker poll mark-paid sau 10 phút timeout.
    return { status: "pending" };
  }

  private formatVnpDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
  }
}
