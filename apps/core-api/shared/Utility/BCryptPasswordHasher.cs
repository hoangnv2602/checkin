namespace SaasCheckin.Utility;

/// <summary>
/// BCrypt password hasher. Cost factor 12 (Phase 1 default; tăng lên 13+ khi
/// CPU cho phép). Tương thích với format <c>$2a$12$...</c>.
///
/// Phase 1: tất cả passwords dùng BCrypt. Phase 2+ có thể add Argon2id làm
/// alternative cho high-value accounts.
/// </summary>
public sealed class BCryptPasswordHasher : IPasswordHasher
{
    private const int CostFactor = 12;

    public string HashPassword(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            throw new ArgumentException("Password không được rỗng.", nameof(plainText));
        if (plainText.Length < 8)
            throw new ArgumentException("Password phải ≥ 8 ký tự.", nameof(plainText));
        return BCrypt.Net.BCrypt.HashPassword(plainText, CostFactor);
    }

    public bool VerifyPassword(string plainText, string hash)
    {
        if (string.IsNullOrEmpty(plainText) || string.IsNullOrEmpty(hash))
            return false;
        try
        {
            return BCrypt.Net.BCrypt.Verify(plainText, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }
}
