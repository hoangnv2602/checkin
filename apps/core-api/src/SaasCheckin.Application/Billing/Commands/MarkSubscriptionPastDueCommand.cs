using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

/// <summary>
/// MarkSubscriptionPastDueCommand — Phase 5 I-501: webhook invoice.payment_failed
/// → fire MarkPastDue transition. Org vẫn còn quyền truy cập read-only,
/// UI sẽ hiển thị banner "Payment failed — update card".
/// </summary>
public sealed record MarkSubscriptionPastDueCommand(Guid OrganizationId) : IRequest;
