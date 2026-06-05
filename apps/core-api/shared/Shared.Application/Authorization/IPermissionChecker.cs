namespace SaasCheckin.Shared.Application.Authorization;

/// <summary>
/// Permission check interface. Implementation reads current user permissions
/// (từ JWT claim <c>permission</c>) rồi check required permissions.
///
/// Phase 1: simplest impl — read từ <c>IHttpContextAccessor</c> JWT claim.
/// Phase 2+: thêm cache + on-behalf-of checks.
/// </summary>
public interface IPermissionChecker
{
    /// <summary>True nếu current user có TẤT CẢ <paramref name="required"/> permissions.</summary>
    bool HasAll(params string[] required);

    /// <summary>True nếu current user có ÍT NHẤT 1 trong <paramref name="any"/> permissions.</summary>
    bool HasAny(params string[] any);

    /// <summary>Trả exception nếu user thiếu permission. Throw <see cref="ForbiddenException"/>.</summary>
    void EnsureAll(params string[] required);
}

public sealed class ForbiddenException : Exception
{
    public ForbiddenException(string message) : base(message) { }
    public ForbiddenException(string message, Exception inner) : base(message, inner) { }
}
