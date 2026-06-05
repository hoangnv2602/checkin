namespace SaasCheckin.Shared.Domain;

/// <summary>
/// IRepository — base contract cho repository trong DDD.
/// Aggregate root T có identity TKey.
///
/// Phase 1: Add + Update. Phase 2+: Specification pattern, soft delete filter,
/// domain event dispatch hook.
/// </summary>
public interface IRepository<T, in TKey>
    where T : class
    where TKey : notnull
{
    Task<T?> FindByIdAsync(TKey id, CancellationToken ct = default);
    Task AddAsync(T aggregate, CancellationToken ct = default);

    /// <summary>EF Core tracked aggregate (mutated qua domain methods).</summary>
    Task UpdateAsync(T aggregate, CancellationToken ct = default);

    void Remove(T aggregate);
}
