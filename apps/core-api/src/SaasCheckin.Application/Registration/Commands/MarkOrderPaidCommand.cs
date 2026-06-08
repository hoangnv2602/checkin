using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;
using RegistrationEntity = SaasCheckin.Domain.Registration.Aggregates.Registration;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// MarkOrderPaidCommand — BFF gọi sau khi nhận webhook "payment_succeeded"
/// từ Stripe / VNPay. Aggregate transition Pending → Paid + raise event.
/// Tạo kèm <c>OrderPaidIntegrationEvent</c> để Notification context gửi email.
/// </summary>
public sealed record MarkOrderPaidCommand(
    Guid OrganizationId,
    Guid OrderId,
    string ProviderSessionId) : IRequest;
