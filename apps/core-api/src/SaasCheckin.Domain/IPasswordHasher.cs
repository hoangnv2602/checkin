namespace SaasCheckin.Utility;

/// <summary>
/// IPasswordHasher — Phase 0 stub interface.
/// Phase 1+ (I-101) sẽ implement BCryptPasswordHasher (cost 12).
/// </summary>
public interface IPasswordHasher
{
    string HashPassword(string plainText);
    bool VerifyPassword(string plainText, string hash);
}
