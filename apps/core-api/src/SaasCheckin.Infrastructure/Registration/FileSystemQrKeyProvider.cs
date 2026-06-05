using NSec.Cryptography;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Infrastructure.Registration;

/// <summary>
/// FileSystemQrKeyProvider — load Ed25519 seed từ <c>/etc/api-gateway/keys/{tenant_id}.key</c>.
/// Phase 3 dev-only stub. Production: HashiCorp Vault / AWS KMS.
/// </summary>
public sealed class FileSystemQrKeyProvider : IKeyProvider
{
    private const string KeyDirectory = "/etc/api-gateway/keys";
    private const string FallbackDirectory = "/tmp/saas-checkin-keys";
    private static readonly SignatureAlgorithm Algo = SignatureAlgorithm.Ed25519;
    private const int SeedBytes = 32;

    public Key GetOrCreate(Guid organizationId)
    {
        var dir = Directory.Exists(KeyDirectory) ? KeyDirectory : FallbackDirectory;
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, $"{organizationId}.key");
        byte[] seed;
        if (File.Exists(path))
        {
            seed = File.ReadAllBytes(path);
            if (seed.Length != SeedBytes)
                throw new InvalidOperationException($"Invalid Ed25519 seed at {path} (got {seed.Length} bytes)");
        }
        else
        {
            var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            seed = new byte[SeedBytes];
            rng.GetBytes(seed);
            File.WriteAllBytes(path, seed);
        }
        return Key.Import(Algo, seed, KeyBlobFormat.RawPrivateKey);
    }
}
