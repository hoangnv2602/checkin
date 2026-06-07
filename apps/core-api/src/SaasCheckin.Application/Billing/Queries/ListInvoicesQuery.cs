using MediatR;
using SaasCheckin.Domain.Billing.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed record ListInvoicesQuery(Guid OrganizationId, int Skip, int Take)
    : IRequest<IReadOnlyList<InvoiceDto>>;

public sealed record InvoiceDto(
    Guid Id,
    Guid OrganizationId,
    Guid SubscriptionId,
    long AmountMinor,
    string Currency,
    string? ProviderInvoiceId,
    string IssuedAt,
    string? PaidAt);

public sealed class ListInvoicesQueryHandler
    : IRequestHandler<ListInvoicesQuery, IReadOnlyList<InvoiceDto>>
{
    private readonly IInvoiceRepository _invoices;
    public ListInvoicesQueryHandler(IInvoiceRepository invoices) => _invoices = invoices;

    public async Task<IReadOnlyList<InvoiceDto>> Handle(ListInvoicesQuery q, CancellationToken ct)
    {
        var take = Math.Clamp(q.Take, 1, 200);
        var skip = Math.Max(0, q.Skip);
        var rows = await _invoices.ListByOrganizationAsync(q.OrganizationId, skip, take, ct);
        return rows.Select(i => new InvoiceDto(
            i.Id.Value,
            i.OrganizationId,
            i.SubscriptionId.Value,
            i.Amount.AmountMinor,
            i.Amount.Currency,
            i.ProviderInvoiceId,
            i.IssuedAt.ToString("O"),
            i.PaidAt?.ToString("O"))).ToList();
    }
}
