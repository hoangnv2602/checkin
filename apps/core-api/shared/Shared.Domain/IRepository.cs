namespace SaasCheckin.Shared.Domain;

/// <summary>
/// IRepository — base contract cho repository trong DDD.
/// Aggregate root T có identity TKey.
/// Phase 0 stub. Phase 1+ sẽ thêm: Specification pattern, soft delete filter.
/// </summary>
public interface IRepository<T, in TKey>
    where T : class
    where TKey : notnull
{
    Task<T?> FindByIdAsync(TKey id, CancellationToken ct = default);
    Task AddAsync(T aggregate, CancellationToken ct = default);
    void Remove(T aggregate);
}
