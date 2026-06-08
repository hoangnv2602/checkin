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
