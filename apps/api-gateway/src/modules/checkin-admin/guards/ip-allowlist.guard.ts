/**
 * apps/api-gateway/src/modules/checkin-admin/guards/ip-allowlist.guard.ts
 *
 * I-107 — IpAllowlistGuard. PLATFORM_ADMIN_IP_ALLOWLIST env, comma-separated CIDR.
 * Default-deny if env unset. Supports IPv4 + IPv6.
 */
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import * as net from "node:net";

interface ParsedCidr {
  base: bigint;
  bits: number;
  isIpv6: boolean;
}

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  private readonly cidrs: ParsedCidr[];

  constructor() {
    const raw = process.env.PLATFORM_ADMIN_IP_ALLOWLIST ?? "";
    this.cidrs = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => parseCidr(s));
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (this.cidrs.length === 0) {
      throw new ForbiddenException(
        "IpAllowlist not configured (set PLATFORM_ADMIN_IP_ALLOWLIST)",
      );
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? "0.0.0.0";
    const cleanIp = ip.replace(/^::ffff:/, "");
    if (!this.cidrs.some((c) => matches(cleanIp, c))) {
      throw new ForbiddenException(`IP ${cleanIp} not in allowlist`);
    }
    return true;
  }
}

function parseCidr(cidr: string): ParsedCidr {
  const [addr, bitsStr] = cidr.split("/");
  const isIpv6 = addr.includes(":");
  const maxBits = isIpv6 ? 128 : 32;
  const bits = bitsStr !== undefined ? parseInt(bitsStr, 10) : maxBits;
  const base = ipToBigInt(addr, isIpv6);
  return { base, bits, isIpv6 };
}

function ipToBigInt(ip: string, isIpv6: boolean): bigint {
  if (!isIpv6) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      throw new Error(`Invalid IPv4: ${ip}`);
    }
    return BigInt((parts[0] << 24 >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]);
  }
  // IPv6: normalize with Node's net module
  const normalized = (net as any).isIP(ip) === 6 ? expandIpv6(ip) : ip;
  const groups = normalized.split(":").map((g) => g.padStart(4, "0"));
  let hex = groups.join("");
  if (hex.length < 32) hex = "0".repeat(32 - hex.length) + hex;
  return BigInt("0x" + hex);
}

function expandIpv6(ip: string): string {
  if (ip.includes("::")) {
    const [left, right] = ip.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    const fill = Array(8 - leftGroups.length - rightGroups.length).fill("0");
    return [...leftGroups, ...fill, ...rightGroups].join(":");
  }
  return ip;
}

function matches(ip: string, cidr: ParsedCidr): boolean {
  try {
    const ipBig = ipToBigInt(ip, cidr.isIpv6);
    if (cidr.bits === 0) return true;
    const mask = (~0n << BigInt(128 - cidr.bits)) & ((1n << 128n) - 1n);
    const normalized = cidr.isIpv6
      ? (ipBig & mask) === (cidr.base & mask)
      : ((ipBig & BigInt(0xffffffff)) === (cidr.base & BigInt(0xffffffff)));
    return normalized;
  } catch {
    return false;
  }
}
