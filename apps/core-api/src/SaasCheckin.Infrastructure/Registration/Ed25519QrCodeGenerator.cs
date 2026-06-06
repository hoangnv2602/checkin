using System.Text;
using System.Text.Json;
using NSec.Cryptography;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Domain.Registration.ValueObjects;
using StackExchange.Redis;

namespace SaasCheckin.Infrastructure.Registration;

/// <summary>
/// Ed25519QrCodeGenerator — ký QrPayload bằng Ed25519 với key theo tenant.
///
/// Key resolution: <c>{tenant_id}</c> → private key bytes (32 bytes) cached
/// trong Redis 24h. Phase 3 dev: load từ <c>/etc/api-gateway/keys/{tenant_id}.key</c>
/// qua file provider; production sẽ dùng HashiCorp Vault / KMS.
///
/// Verification (offline-capable) dùng cùng key — Flutter app cache JWKS tương
/// ứng trong secure storage để verify khi mất mạng.
/// </summary>
public sealed class Ed25519QrCodeGenerator : IQrCodeGenerator
{
    private static readonly SignatureAlgorithm Algo = SignatureAlgorithm.Ed25519;
    private static readonly RedisKey KeyCachePrefix = "qr:signing-key:";

    private readonly IConnectionMultiplexer? _redis;
    private readonly IKeyProvider _keys;

    public Ed25519QrCodeGenerator(IKeyProvider keys, IConnectionMultiplexer? redis = null)
    {
        _keys = keys;
        _redis = redis;
    }

    public QrSignature Sign(QrPayload payload, Guid organizationId)
    {
        var key = LoadOrDeriveKey(organizationId);
        var bytes = Canonicalize(payload);
        var sig = Algo.Sign(key, bytes);
        return new QrSignature(sig);
    }

    public bool Verify(QrPayload payload, QrSignature signature, Guid organizationId)
    {
        var key = LoadOrDeriveKey(organizationId);
        var bytes = Canonicalize(payload);
        return Algo.Verify(key.PublicKey, bytes, signature.Value);
    }

    private Key LoadOrDeriveKey(Guid organizationId)
    {
        var redis = _redis;
        // StackExchange.Redis 2.8+ marks RedisKey operator+ obsolete in favour of WithPrefix,
        // but WithPrefix lives on RedisChannel. Build the full key string then wrap in RedisKey
        // constructor (the string ctor is the recommended compose path for RedisKey itself).
        var cacheKey = new RedisKey(KeyCachePrefix.ToString() + organizationId);
        if (redis is not null)
        {
            var cached = redis.GetDatabase().StringGet(cacheKey);
            if (cached.HasValue)
            {
                var seed = Convert.FromBase64String(cached!);
                return Key.Import(Algo, seed, KeyBlobFormat.RawPrivateKey);
            }
        }

        var key = _keys.GetOrCreate(organizationId);
        if (redis is not null)
        {
            var seed = key.Export(KeyBlobFormat.RawPrivateKey);
            redis.GetDatabase().StringSet(
                cacheKey,
                Convert.ToBase64String(seed),
                TimeSpan.FromHours(24));
        }
        return key;
    }

    /// <summary>Canonical JSON — property order cố định để verify khớp.</summary>
    private static byte[] Canonicalize(QrPayload p)
    {
        var dict = new Dictionary<string, object?>
        {
            ["jti"] = p.Jti,
            ["registrationId"] = p.RegistrationId,
            ["eventId"] = p.EventId,
            ["organizationId"] = p.OrganizationId,
            ["issuedAt"] = p.IssuedAt.ToUnixTimeSeconds(),
            ["expiresAt"] = p.ExpiresAt.ToUnixTimeSeconds()
        };
        return Encoding.UTF8.GetBytes(JsonSerializer.Serialize(dict));
    }
}

/// <summary>IKeyProvider — abstraction cho key storage (file, Vault, KMS).</summary>
public interface IKeyProvider
{
    Key GetOrCreate(Guid organizationId);
}
