using Grpc.Core;
using MediatR;
using Microsoft.Extensions.Logging;
using SaasCheckin.Application.EventManagement.Commands;
using SaasCheckin.Application.EventManagement.Queries;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// Event gRPC service. BFF (NestJS api-gateway) gọi tới đây để
/// list/get/create/update/publish/cancel/complete event + session.
///
/// Tenant context đến qua metadata <c>organization_id</c> trên từng request
/// → set qua <see cref="ICurrentTenant"/> trước khi handler chạy.
/// </summary>
public sealed class EventGrpcService
{
    private const string ServiceName = "saas_checkin.event.v1.EventService";

    private readonly IMediator _mediator;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<EventGrpcService> _logger;

    public EventGrpcService(
        IMediator mediator,
        ICurrentTenant currentTenant,
        ILogger<EventGrpcService> logger)
    {
        _mediator = mediator;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public ServerServiceDefinition BindService()
    {
        var b = ServerServiceDefinition.CreateBuilder();
        b.AddMethod(BuildMethod<ListEventsRequest, ListEventsResponse>("ListEvents"),
            (req, ctx) => ListEvents(req, ctx));
        b.AddMethod(BuildMethod<GetEventRequest, EventMessage>("GetEvent"),
            (req, ctx) => GetEvent(req, ctx));
        b.AddMethod(BuildMethod<CreateEventRequest, EventMessage>("CreateEvent"),
            (req, ctx) => CreateEvent(req, ctx));
        b.AddMethod(BuildMethod<UpdateEventRequest, EventMessage>("UpdateEvent"),
            (req, ctx) => UpdateEvent(req, ctx));
        b.AddMethod(BuildMethod<PublishEventRequest, EventMessage>("PublishEvent"),
            (req, ctx) => PublishEvent(req, ctx));
        b.AddMethod(BuildMethod<CancelEventRequest, EventMessage>("CancelEvent"),
            (req, ctx) => CancelEvent(req, ctx));
        b.AddMethod(BuildMethod<CompleteEventRequest, EventMessage>("CompleteEvent"),
            (req, ctx) => CompleteEvent(req, ctx));
        b.AddMethod(BuildMethod<ListSessionsRequest, ListSessionsResponse>("ListSessions"),
            (req, ctx) => ListSessions(req, ctx));
        b.AddMethod(BuildMethod<AddSessionRequest, SessionMessage>("AddSession"),
            (req, ctx) => AddSession(req, ctx));
        b.AddMethod(BuildMethod<UpdateSessionRequest, SessionMessage>("UpdateSession"),
            (req, ctx) => UpdateSession(req, ctx));
        b.AddMethod(BuildMethod<ChangeSessionStatusRequest, SessionMessage>("ChangeSessionStatus"),
            (req, ctx) => ChangeSessionStatus(req, ctx));
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

    // ===== Event RPCs =====

    public async Task<ListEventsResponse> ListEvents(ListEventsRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var status = ParseEnumOrNull<Domain.EventManagement.ValueObjects.EventStatus>(req.Status);
        var events = await _mediator.Send(
            new ListEventsQuery(orgId, status, req.Skip, req.Take), ctx.CancellationToken);
        var resp = new ListEventsResponse();
        resp.Events.AddRange(events.Select(EventMessage.From));
        return resp;
    }

    public async Task<EventMessage> GetEvent(GetEventRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var ev = await _mediator.Send(
            new GetEventQuery(orgId, eventId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Event not found"));
        return EventMessage.From(ev);
    }

    public async Task<EventMessage> CreateEvent(CreateEventRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var id = await _mediator.Send(new CreateEventCommand(
            orgId, req.Title, req.Description,
            ParseDate(req.StartAt, "start_at"), ParseDate(req.EndAt, "end_at"),
            req.Capacity), ctx.CancellationToken);
        var ev = await _mediator.Send(new GetEventQuery(orgId, id), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.Internal, "Event created but not found"));
        return EventMessage.From(ev);
    }

    public async Task<EventMessage> UpdateEvent(UpdateEventRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");

        DateTimeOffset? startAt = string.IsNullOrEmpty(req.StartAt) ? null : ParseDate(req.StartAt, "start_at");
        DateTimeOffset? endAt = string.IsNullOrEmpty(req.EndAt) ? null : ParseDate(req.EndAt, "end_at");
        int? capacity = req.Capacity > 0 ? req.Capacity : null;

        await _mediator.Send(new UpdateEventCommand(
            orgId, eventId,
            NullIfEmpty(req.Title), req.ClearDescription ? null : NullIfEmpty(req.Description),
            startAt, endAt, capacity), ctx.CancellationToken);

        var ev = await _mediator.Send(new GetEventQuery(orgId, eventId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Event disappeared"));
        return EventMessage.From(ev);
    }

    public async Task<EventMessage> PublishEvent(PublishEventRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        await _mediator.Send(new PublishEventCommand(orgId, eventId), ctx.CancellationToken);
        var ev = await _mediator.Send(new GetEventQuery(orgId, eventId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Event disappeared"));
        return EventMessage.From(ev);
    }

    public async Task<EventMessage> CancelEvent(CancelEventRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        await _mediator.Send(new CancelEventCommand(orgId, eventId), ctx.CancellationToken);
        var ev = await _mediator.Send(new GetEventQuery(orgId, eventId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Event disappeared"));
        return EventMessage.From(ev);
    }

    public async Task<EventMessage> CompleteEvent(CompleteEventRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        await _mediator.Send(new CompleteEventCommand(orgId, eventId), ctx.CancellationToken);
        var ev = await _mediator.Send(new GetEventQuery(orgId, eventId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Event disappeared"));
        return EventMessage.From(ev);
    }

    // ===== Session RPCs =====

    public async Task<ListSessionsResponse> ListSessions(ListSessionsRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var sessions = await _mediator.Send(
            new ListSessionsByEventQuery(orgId, eventId, req.Skip, req.Take), ctx.CancellationToken);
        var resp = new ListSessionsResponse();
        resp.Sessions.AddRange(sessions.Select(SessionMessage.From));
        return resp;
    }

    public async Task<SessionMessage> AddSession(AddSessionRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        Guid? venueId = Guid.TryParse(req.VenueId, out var v) ? v : null;

        var id = await _mediator.Send(new AddSessionCommand(
            orgId, eventId,
            req.Title, NullIfEmpty(req.Description),
            ParseDate(req.StartAt, "start_at"), ParseDate(req.EndAt, "end_at"),
            req.Capacity, venueId), ctx.CancellationToken);

        var sessions = await _mediator.Send(
            new ListSessionsByEventQuery(orgId, eventId, 0, 100), ctx.CancellationToken);
        var created = sessions.FirstOrDefault(s => s.Id == id)
            ?? throw new RpcException(new Status(StatusCode.Internal, "Session created but not found"));
        return SessionMessage.From(created);
    }

    public async Task<SessionMessage> UpdateSession(UpdateSessionRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var sessionId = ParseGuid(req.SessionId, "session_id");
        DateTimeOffset? startAt = string.IsNullOrEmpty(req.StartAt) ? null : ParseDate(req.StartAt, "start_at");
        DateTimeOffset? endAt = string.IsNullOrEmpty(req.EndAt) ? null : ParseDate(req.EndAt, "end_at");
        int? capacity = req.Capacity > 0 ? req.Capacity : null;
        Guid? venueId = req.ClearVenue ? null : (Guid.TryParse(req.VenueId, out var v) ? v : null);

        await _mediator.Send(new UpdateSessionCommand(
            orgId, sessionId,
            NullIfEmpty(req.Title), req.ClearDescription ? null : NullIfEmpty(req.Description),
            startAt, endAt, capacity, venueId, req.ClearVenue), ctx.CancellationToken);

        var allSessions = await FetchAllSessionsForSession(orgId, sessionId, ctx.CancellationToken);
        var updated = allSessions.FirstOrDefault(s => s.Id == sessionId)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Session disappeared"));
        return SessionMessage.From(updated);
    }

    public async Task<SessionMessage> ChangeSessionStatus(ChangeSessionStatusRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var sessionId = ParseGuid(req.SessionId, "session_id");
        if (!Enum.TryParse<Application.EventManagement.Commands.SessionAction>(Capitalize(req.Action), out var action))
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Unknown session action: {req.Action}"));
        await _mediator.Send(new ChangeSessionStatusCommand(orgId, sessionId, action), ctx.CancellationToken);
        var allSessions = await FetchAllSessionsForSession(orgId, sessionId, ctx.CancellationToken);
        var updated = allSessions.FirstOrDefault(s => s.Id == sessionId)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Session disappeared"));
        return SessionMessage.From(updated);
    }

    private async Task<IReadOnlyList<Domain.EventManagement.Aggregates.Session>> FetchAllSessionsForSession(
        Guid orgId, Guid sessionId, CancellationToken ct)
    {
        // Workaround: scan events until we find one containing this session.
        // Real fix: dedicated GetSessionQuery + ISessionRepository.FindByIdAsync (already exists
        // in repo; just needs a query handler). For Phase 2 quick win, use list-all + filter.
        var allEvents = await _mediator.Send(new ListEventsQuery(orgId, null, 0, 200), ct);
        foreach (var ev in allEvents)
        {
            var sessions = await _mediator.Send(
                new ListSessionsByEventQuery(orgId, ev.Id, 0, 200), ct);
            var found = sessions.FirstOrDefault(s => s.Id == sessionId);
            if (found is not null) return sessions;
        }
        return Array.Empty<Domain.EventManagement.Aggregates.Session>();
    }

    private static T? ParseEnumOrNull<T>(string value) where T : struct, Enum
        => string.IsNullOrEmpty(value) ? null
            : Enum.TryParse<T>(value, ignoreCase: true, out var parsed) ? parsed : null;

    private static Guid ParseGuid(string value, string paramName)
    {
        if (!Guid.TryParse(value, out var id) || id == Guid.Empty)
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Invalid {paramName}"));
        return id;
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrEmpty(s) ? null : s;

    private static string Capitalize(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];

    private static DateTimeOffset ParseDate(string value, string paramName)
    {
        if (!DateTimeOffset.TryParse(value, out var dt))
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Invalid {paramName}"));
        return dt;
    }
}

// ----- Raw message types (Phase 2 stand-in cho proto-generated) -----
// Match csharp_namespace "SaasCheckin.Grpc.Event.V1" trong event.proto.

public class EventMessage
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartAt { get; set; } = string.Empty;
    public string EndAt { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int SoldTickets { get; set; }
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;

    public static EventMessage From(Domain.EventManagement.Aggregates.Event e) => new()
    {
        Id = e.Id.ToString(),
        OrganizationId = e.OrganizationId.ToString(),
        Title = e.Title,
        Description = e.Description ?? string.Empty,
        StartAt = e.Period.StartAt.ToString("O"),
        EndAt = e.Period.EndAt.ToString("O"),
        Capacity = e.Capacity,
        SoldTickets = e.SoldTickets,
        Status = e.Status.ToString().ToLowerInvariant(),
        CreatedAt = e.CreatedAt.ToString("O"),
        UpdatedAt = e.UpdatedAt.ToString("O"),
    };
}

public class ListEventsRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int Skip { get; set; }
    public int Take { get; set; }
}

public class ListEventsResponse
{
    public List<EventMessage> Events { get; set; } = new();
}

public class GetEventRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
}

public class CreateEventRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartAt { get; set; } = string.Empty;
    public string EndAt { get; set; } = string.Empty;
    public int Capacity { get; set; }
}

public class UpdateEventRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartAt { get; set; } = string.Empty;
    public string EndAt { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public bool ClearDescription { get; set; }
}

public class PublishEventRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
}

public class CancelEventRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
}

public class CompleteEventRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
}

public class SessionMessage
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string VenueId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartAt { get; set; } = string.Empty;
    public string EndAt { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;

    public static SessionMessage From(Domain.EventManagement.Aggregates.Session s) => new()
    {
        Id = s.Id.ToString(),
        OrganizationId = s.OrganizationId.ToString(),
        EventId = s.EventId.ToString(),
        VenueId = s.VenueId?.ToString() ?? string.Empty,
        Title = s.Title,
        Description = s.Description ?? string.Empty,
        StartAt = s.Period.StartAt.ToString("O"),
        EndAt = s.Period.EndAt.ToString("O"),
        Capacity = s.Capacity,
        Status = s.Status.ToString().ToLowerInvariant(),
        CreatedAt = s.CreatedAt.ToString("O"),
        UpdatedAt = s.UpdatedAt.ToString("O"),
    };
}

public class ListSessionsRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public int Skip { get; set; }
    public int Take { get; set; }
}

public class ListSessionsResponse
{
    public List<SessionMessage> Sessions { get; set; } = new();
}

public class AddSessionRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartAt { get; set; } = string.Empty;
    public string EndAt { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string VenueId { get; set; } = string.Empty;
}

public class UpdateSessionRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartAt { get; set; } = string.Empty;
    public string EndAt { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string VenueId { get; set; } = string.Empty;
    public bool ClearDescription { get; set; }
    public bool ClearVenue { get; set; }
}

public class ChangeSessionStatusRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
}
