using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.ValueObjects;

namespace SaasCheckin.Domain.Billing.Repositories;

public interface ISubscriptionRepository
{
    Task<Subscription?> FindByOrganizationAsync(Guid organizationId, CancellationToken ct = default);
    Task<Subscription?> FindByIdAsync(SubscriptionId id, CancellationToken ct = default);
    Task AddAsync(Subscription subscription, CancellationToken ct = default);
    Task UpdateAsync(Subscription subscription, CancellationToken ct = default);
}

public interface IPlanRepository
{
    Task<Plan?> FindByIdAsync(PlanId id, CancellationToken ct = default);
    Task<Plan?> FindDefaultAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Plan>> ListAsync(CancellationToken ct = default);
    Task AddAsync(Plan plan, CancellationToken ct = default);
    Task UpdateAsync(Plan plan, CancellationToken ct = default);
}

public interface IInvoiceRepository
{
    Task<Invoice?> FindByIdAsync(InvoiceId id, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<Invoice>> ListByOrganizationAsync(Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task AddAsync(Invoice invoice, CancellationToken ct = default);
}
