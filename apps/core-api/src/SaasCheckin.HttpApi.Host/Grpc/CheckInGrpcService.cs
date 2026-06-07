using Grpc.Core;
using MediatR;
using Microsoft.Extensions.Logging;
using SaasCheckin.Application.CheckIn.Commands;
using SaasCheckin.Application.CheckIn.Queries;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// CheckIn gRPC service. BFF (NestJS api-gateway) gọi tới đây để
/// scan QR, undo check-in, get event stats. Tenant context đến qua
/// metadata <c>organization_id</c> trên từng request → set qua
/// <see cref="ICurrentTenant"/> trước khi handler chạy.
///
/// Pattern: raw POCO message types + manual <see cref="BindService"/>
/// (mirror IdentityGrpcService / EventGrpcService). Khi `buf generate`
/// chạy (I-105 follow-up), sẽ thay bằng generated abstract base +
/// static <c>Service</c>.
/// </summary>
public sealed class CheckInGrpcService
{
    private const string ServiceName = "saas_checkin.checkin.v1.CheckInService";

    private readonly IMediator _mediator;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<CheckInGrpcService> _logger;

    public CheckInGrpcService(
        IMediator mediator,
        ICurrentTenant currentTenant,
        ILogger<CheckInGrpcService> logger)
    {
        _mediator = mediator;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public ServerServiceDefinition BindService()
    {
        var b = ServerServiceDefinition.CreateBuilder();
        b.AddMethod(BuildMethod<ScanRequest, ScanResponse>("Scan"),
            (req, ctx) => Scan(req, ctx));
        b.AddMethod(BuildMethod<GetEventStatsRequest, GetEventStatsResponse>("GetEventStats"),
            (req, ctx) => GetEventStats(req, ctx));
        b.AddMethod(BuildMethod<UndoCheckInRequest, UndoCheckInResponse>("UndoCheckIn"),
            (req, ctx) => UndoCheckIn(req, ctx));
        return b.Build();
    }

    private static Method<TRequest, TResponse> BuildMethod<TRequest, TResponse>(string name)
        where TRequest : class where TResponse : class
        => new(
            MethodType.Unary, ServiceName, name,
            CreateMarshaller<TRequest>(),
            CreateMarshaller<TResponse>());

    private static Marshaller<T> CreateMarshaller<T>() where T : class
        => Marshallers.Create(
            (T value) => System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(value),
            (byte[] data) => System.Text.Json.JsonSerializer.Deserialize<T>(data)
                ?? throw new InvalidOperationException("Cannot deserialize gRPC payload"));

    // ===== RPCs =====

    public async Task<ScanResponse> Scan(ScanRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var gateId = ParseGuid(req.GateId, "gate_id");
        var staffUserId = ParseGuid(req.StaffUserId, "staff_user_id");
        var jti = ParseGuid(req.Jti, "jti");
        var registrationId = ParseGuid(req.RegistrationId, "registration_id");
        var signature = string.IsNullOrEmpty(req.Signature) ? string.Empty : req.Signature;
        _currentTenant.SetTenant(orgId);

        var result = await _mediator.Send(new ScanQrCommand(
            orgId, eventId, gateId, staffUserId, jti, registrationId, signature), ctx.CancellationToken);

        return new ScanResponse
        {
            Ok = result.Status == Domain.CheckIn.ValueObjects.CheckInStatus.Success,
            Message = result.RejectReason ?? (result.Status == Domain.CheckIn.ValueObjects.CheckInStatus.Success
                ? "Checked in" : "Check-in failed"),
            CheckInRecordId = result.CheckInRecordId.ToString(),
            Status = result.Status.ToString(),
            RejectReason = result.RejectReason ?? string.Empty,
            AttendeeName = result.AttendeeName ?? string.Empty,
            Result = MapResult(result.Status, !string.IsNullOrEmpty(result.RejectReason)),
        };
    }

    public async Task<GetEventStatsResponse> GetEventStats(GetEventStatsRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        _currentTenant.SetTenant(orgId);

        var stats = await _mediator.Send(new GetEventStatsQuery(orgId, eventId), ctx.CancellationToken);
        return new GetEventStatsResponse
        {
            EventId = stats.EventId.ToString(),
            TotalRegistered = stats.TotalRegistrations,
            TotalCheckedIn = stats.CheckedIn,
            TotalPending = Math.Max(0, stats.TotalRegistrations - stats.CheckedIn),
            RejectedCount = stats.Rejected,
            CheckInPercent = stats.CheckInPercent,
        };
    }

    public async Task<UndoCheckInResponse> UndoCheckIn(UndoCheckInRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var checkInRecordId = ParseGuid(req.CheckInRecordId, "check_in_record_id");
        var staffUserId = ParseGuid(req.StaffUserId, "staff_user_id");
        var reason = string.IsNullOrEmpty(req.Reason) ? "Undo" : req.Reason;
        _currentTenant.SetTenant(orgId);

        try
        {
            await _mediator.Send(new UndoCheckInCommand(
                orgId, eventId, checkInRecordId, staffUserId, reason), ctx.CancellationToken);
            return new UndoCheckInResponse { Ok = true, Message = "Undone" };
        }
        catch (InvalidOperationException ex)
        {
            throw new RpcException(new Status(StatusCode.FailedPrecondition, ex.Message));
        }
    }

    // ===== Helpers =====

    private static Guid ParseGuid(string value, string paramName)
    {
        if (!Guid.TryParse(value, out var id) || id == Guid.Empty)
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Invalid {paramName}"));
        return id;
    }

    private static string MapResult(Domain.CheckIn.ValueObjects.CheckInStatus status, bool hasReason)
    {
        return status switch
        {
            Domain.CheckIn.ValueObjects.CheckInStatus.Success => "CHECK_IN_RESULT_OK",
            Domain.CheckIn.ValueObjects.CheckInStatus.Duplicate => "CHECK_IN_RESULT_ALREADY_CHECKED_IN",
            Domain.CheckIn.ValueObjects.CheckInStatus.Rejected when hasReason => "CHECK_IN_RESULT_INVALID_QR",
            _ => "CHECK_IN_RESULT_UNSPECIFIED",
        };
    }
}

// ===== Raw message types (Phase 4 stand-in cho proto-generated) =====
// Match csharp_namespace "SaasCheckin.Proto.Checkin.V1" trong checkin.proto.

public class ScanRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string GateId { get; set; } = string.Empty;
    public string StaffUserId { get; set; } = string.Empty;
    public string Jti { get; set; } = string.Empty;
    public string RegistrationId { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
    public string ScannedAt { get; set; } = string.Empty;
}

public class ScanResponse
{
    public bool Ok { get; set; }
    public string Message { get; set; } = string.Empty;
    public string CheckInRecordId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string RejectReason { get; set; } = string.Empty;
    public string AttendeeName { get; set; } = string.Empty;
    public string Result { get; set; } = string.Empty;
}

public class GetEventStatsRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
}

public class GetEventStatsResponse
{
    public string EventId { get; set; } = string.Empty;
    public int TotalRegistered { get; set; }
    public int TotalCheckedIn { get; set; }
    public int TotalPending { get; set; }
    public int RejectedCount { get; set; }
    public double CheckInPercent { get; set; }
    public string LastScanAt { get; set; } = string.Empty;
}

public class UndoCheckInRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string CheckInRecordId { get; set; } = string.Empty;
    public string StaffUserId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public class UndoCheckInResponse
{
    public bool Ok { get; set; }
    public string Message { get; set; } = string.Empty;
}
