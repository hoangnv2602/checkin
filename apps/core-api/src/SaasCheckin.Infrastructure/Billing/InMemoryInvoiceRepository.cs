// apps/core-api/src/SaasCheckin.Infrastructure/Billing/InMemoryInvoiceRepository.cs
//
// Phase 0 in-memory stub for IInvoiceRepository. Append-only — we never
// update an Invoice, only add new ones. The dictionary is keyed by
// (orgId, invoiceId) so cross-tenant lookups stay isolated.
using System.Collections.Concurrent;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;

namespace SaasCheckin.Infrastructure.Billing;

public sealed class InMemoryInvoiceRepository : IInvoiceRepository
{
    private readonly ConcurrentDictionary<(Guid Org, Guid Id), Invoice> _store = new();

    public Task<Invoice?> FindByIdAsync(InvoiceId id, Guid organizationId, CancellationToken ct = default)
    {
        _store.TryGetValue((organizationId, id.Value), out var inv);
        return Task.FromResult<Invoice?>(inv);
    }

    public Task<IReadOnlyList<Invoice>> ListByOrganizationAsync(
        Guid organizationId, int skip, int take, CancellationToken ct = default)
    {
        var page = _store.Values
            .Where(i => i.OrganizationId == organizationId)
            .OrderByDescending(i => i.IssuedAt)
            .Skip(skip)
            .Take(take)
            .ToList();
        return Task.FromResult<IReadOnlyList<Invoice>>(page);
    }

    public Task AddAsync(Invoice invoice, CancellationToken ct = default)
    {
        _store[(invoice.OrganizationId, invoice.Id.Value)] = invoice;
        return Task.CompletedTask;
    }
}
