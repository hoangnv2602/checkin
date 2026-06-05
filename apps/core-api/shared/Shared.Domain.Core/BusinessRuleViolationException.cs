namespace SaasCheckin.Shared.Domain.Core;

/// <summary>
/// BusinessRuleViolationException — ném khi aggregate vi phạm invariant
/// (vd: email rỗng, register user khi đã locked, ...).
/// Phase 1+ sẽ wire global exception filter ở HttpApi.Host map → 400/422.
/// </summary>
public sealed class BusinessRuleViolationException : Exception
{
    public BusinessRuleViolationException(string message) : base(message) { }
    public BusinessRuleViolationException(string message, Exception inner) : base(message, inner) { }
}
