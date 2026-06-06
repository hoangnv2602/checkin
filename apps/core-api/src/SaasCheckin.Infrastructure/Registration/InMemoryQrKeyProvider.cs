using NSec.Cryptography;

namespace SaasCheckin.Infrastructure.Registration;

/// <summary>
/// InMemoryQrKeyProvider — test/dev fallback. Tạo key mới cho mỗi tenant
/// in-memory, KHÔNG persist. Chỉ dùng cho unit test; production dùng
/// FileSystemQrKeyProvider (hoặc Vault provider ở Phase 6+).
/// </summary>
public sealed class InMemoryQrKeyProvider : IKeyProvider
{
    private static readonly SignatureAlgorithm Algo = SignatureAlgorithm.Ed25519;
    private readonly object _lock = new();
    private readonly Dictionary<Guid, Key> _cache = new();

    public Key GetOrCreate(Guid organizationId)
    {
        lock (_lock)
        {
            if (_cache.TryGetValue(organizationId, out var existing)) return existing;
            var key = Key.Create(Algo, new KeyCreationParameters { ExportPolicy = KeyExportPolicies.AllowPlaintextExport });
            _cache[organizationId] = key;
            return key;
        }
    }
}
