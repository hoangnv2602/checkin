using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain;     // IRepository<T, TKey>

namespace SaasCheckin.Domain.Identity.Repositories;

/// <summary>
/// Repository contract cho <see cref="User"/> aggregate.
/// KHÔNG khai báo query theo tenant ở đây — User là global, không thuộc tenant nào.
/// Truy vấn theo tenant đi qua <c>IMembershipRepository.FindUsersInTenantAsync</c>.
/// </summary>
public interface IUserRepository : IRepository<User, UserId>
{
    Task<User?> FindByEmailAsync(Email email, CancellationToken ct = default);

    Task<bool> ExistsByEmailAsync(Email email, CancellationToken ct = default);
}
