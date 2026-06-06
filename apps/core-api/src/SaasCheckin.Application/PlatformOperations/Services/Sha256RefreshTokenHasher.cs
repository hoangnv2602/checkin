using System.Security.Cryptography;

namespace SaasCheckin.Application.PlatformOperations.Services;

/// <summary>
/// SHA-256 based refresh-token hasher. Singleton (stateless).
/// </summary>
public sealed class Sha256RefreshTokenHasher : IRefreshTokenHasher
{
    public (string Token, string Hash) Generate()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        var token = Base64UrlEncode(bytes);
        var hash = Hash(token);
        return (token, hash);
    }

    public string Hash(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var digest = SHA256.HashData(bytes);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    private static string Base64UrlEncode(ReadOnlySpan<byte> bytes)
    {
        var b64 = Convert.ToBase64String(bytes);
        return b64.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
