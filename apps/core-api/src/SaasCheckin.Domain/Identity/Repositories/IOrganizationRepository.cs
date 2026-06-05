using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain;

namespace SaasCheckin.Domain.Identity.Repositories;

public interface IOrganizationRepository : IRepository<Organization, OrganizationId>
{
    Task<Organization?> FindBySlugAsync(OrgSlug slug, CancellationToken ct = default);
    Task<bool> ExistsBySlugAsync(OrgSlug slug, CancellationToken ct = default);
}
