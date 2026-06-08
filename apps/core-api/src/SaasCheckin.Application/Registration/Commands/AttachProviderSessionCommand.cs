using MediatR;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// AttachProviderSessionCommand — BFF gọi sau khi tạo Checkout Session ở
/// Stripe / VNPay, lưu session id để webhook resolve lại.
/// </summary>
public sealed record AttachProviderSessionCommand(
    Guid OrganizationId,
    Guid OrderId,
    string ProviderSessionId) : IRequest;
