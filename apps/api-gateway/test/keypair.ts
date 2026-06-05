/**
 * apps/api-gateway/test/keypair.ts
 *
 * Helper: generate RS256 keypair + sign JWT for JwtVerifierService tests.
 */
import { exportSPKI, generateKeyPair, SignJWT, type KeyLike } from "jose";

export interface TestKeyPair {
  privateKey: KeyLike;
  publicKey: KeyLike;
  publicPem: string;
  signToken: (claims: Record<string, unknown>) => Promise<string>;
}

export async function newKeyPair(): Promise<TestKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const publicPem = await exportSPKI(publicKey);

  return {
    privateKey,
    publicKey,
    publicPem,
    signToken: async (claims) => {
      return await new SignJWT(claims as Record<string, unknown>)
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(privateKey);
    },
  };
}
