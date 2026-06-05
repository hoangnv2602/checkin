namespace SaasCheckin.Utility;

/// <summary>
/// IPasswordHasher — password hashing abstraction. Phase 1 chỉ có
/// BCrypt implementation (cost 12). Phase 2+ có thể add Argon2id làm
/// alternative cho high-value accounts.
/// </summary>
public interface IPasswordHasher
{
    string HashPassword(string plainText);
    bool VerifyPassword(string plainText, string hash);
}
