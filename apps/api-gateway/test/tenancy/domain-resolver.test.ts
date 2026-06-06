/**
 * apps/api-gateway/test/tenancy/domain-resolver.test.ts
 *
 * I-804 — Unit test cho DomainResolverService.
 * - normalizeHost strip port + lowercase + strip leading www.
 * - shared domain → default tenant
 * - cache hit → no env lookup
 * - cache miss + env map → cache + return
 * - unknown domain → null
 */
import { DomainResolverService } from "../../src/modules/tenancy/domain-resolver.service";

describe("DomainResolverService.normalizeHost", () => {
  it("strip port", () => {
    expect(DomainResolverService.normalizeHost("events.acme.com:443")).toBe("events.acme.com");
  });
  it("lowercase", () => {
    expect(DomainResolverService.normalizeHost("Events.Acme.COM")).toBe("events.acme.com");
  });
  it("strip leading www.", () => {
    expect(DomainResolverService.normalizeHost("www.events.acme.com")).toBe("events.acme.com");
  });
  it("localhost", () => {
    expect(DomainResolverService.normalizeHost("localhost:3001")).toBe("localhost");
  });
});

describe("DomainResolverService.resolve", () => {
  const fakeRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as unknown as Parameters<typeof DomainResolverService>[0] extends never
    ? { get: jest.Mock; set: jest.Mock; del: jest.Mock }
    : never;

  beforeEach(() => {
    (fakeRedis.get as jest.Mock).mockReset();
    (fakeRedis.set as jest.Mock).mockReset();
  });

  it("shared domain → default tenant, no redis hit", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new DomainResolverService(fakeRedis as any);
    const result = await svc.resolve("web.saas-checkin.com");
    expect(result).toBe("default");
    expect(fakeRedis.get).not.toHaveBeenCalled();
  });

  it("localhost → default tenant", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new DomainResolverService(fakeRedis as any);
    const result = await svc.resolve("localhost:3001");
    expect(result).toBe("default");
  });

  it("custom domain cache hit → return cached tenantId", async () => {
    (fakeRedis.get as jest.Mock).mockResolvedValue("tenant_acme");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new DomainResolverService(fakeRedis as any);
    const result = await svc.resolve("events.acme-corp.com");
    expect(result).toBe("tenant_acme");
  });

  it("cache miss + env map → cache + return", async () => {
    (fakeRedis.get as jest.Mock).mockResolvedValue(null);
    process.env.WHITE_LABEL_DOMAIN_MAP = "events.beta.com:tenant_beta";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new DomainResolverService(fakeRedis as any);
    const result = await svc.resolve("events.beta.com");
    expect(result).toBe("tenant_beta");
    expect(fakeRedis.set).toHaveBeenCalledWith(
      "tenant:domain:events.beta.com",
      "tenant_beta",
      "EX",
      300,
    );
    delete process.env.WHITE_LABEL_DOMAIN_MAP;
  });

  it("cache miss + no env map → null", async () => {
    (fakeRedis.get as jest.Mock).mockResolvedValue(null);
    delete process.env.WHITE_LABEL_DOMAIN_MAP;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new DomainResolverService(fakeRedis as any);
    const result = await svc.resolve("events.unknown.com");
    expect(result).toBeNull();
  });
});
