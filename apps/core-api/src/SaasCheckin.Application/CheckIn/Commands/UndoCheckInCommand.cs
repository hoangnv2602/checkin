using MediatR;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.CheckIn.Commands;

/// <summary>
/// UndoCheckInCommand — chỉ Owner/Admin. Đánh dấu record Success trước đó
/// thành Reverted (Phase 4 stub: tạo thêm 1 record Reverted). Phase 5+
/// sẽ thêm field status='Reverted' trên CheckInRecord.
/// </summary>
public sealed record UndoCheckInCommand(
    Guid OrganizationId,
    Guid EventId,
    Guid CheckInRecordId,
    Guid StaffUserId,
    string Reason) : IRequest;
