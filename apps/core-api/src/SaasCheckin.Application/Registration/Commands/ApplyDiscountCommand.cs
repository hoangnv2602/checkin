using MediatR;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// ApplyDiscountCommand — public, attendee nhập mã trên form. Trả PricingQuote
/// để UI show preview trước khi submit. Validate tồn tại + còn hạn qua
/// delegate trong IPricingService (DI override trong Application).
/// </summary>
public sealed record ApplyDiscountCommand(
    Guid OrganizationId,
    Guid EventId,
    Guid TicketTypeId,
    int Quantity,
    string DiscountCode) : IRequest<ApplyDiscountResult>;

public sealed record ApplyDiscountResult(
    Money Subtotal,
    Money Discount,
    Money Total,
    string? AppliedCode,
    string? FailureReason)
{
    public bool IsValid => FailureReason is null;
}
