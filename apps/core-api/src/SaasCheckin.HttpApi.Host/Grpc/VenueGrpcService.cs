using Grpc.Core;
using MediatR;
using Microsoft.Extensions.Logging;
using SaasCheckin.Application.EventManagement.Commands;
using SaasCheckin.Application.EventManagement.Queries;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// Venue gRPC service. BFF (NestJS api-gateway) gọi tới đây để
/// list/create/update/change-status venue.
/// </summary>
public sealed class VenueGrpcService
{
    private const string ServiceName = "saas_checkin.event.v1.VenueService";

    private readonly IMediator _mediator;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<VenueGrpcService> _logger;

    public VenueGrpcService(
        IMediator mediator,
        ICurrentTenant currentTenant,
        ILogger<VenueGrpcService> logger)
    {
        _mediator = mediator;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public ServerServiceDefinition BindService()
    {
        var b = ServerServiceDefinition.CreateBuilder();
        b.AddMethod(BuildMethod<ListVenuesRequest, ListVenuesResponse>("ListVenues"),
            (req, ctx) => ListVenues(req, ctx));
        b.AddMethod(BuildMethod<AddVenueRequest, VenueMessage>("AddVenue"),
            (req, ctx) => AddVenue(req, ctx));
        b.AddMethod(BuildMethod<UpdateVenueRequest, VenueMessage>("UpdateVenue"),
            (req, ctx) => UpdateVenue(req, ctx));
        b.AddMethod(BuildMethod<ChangeVenueStatusRequest, VenueMessage>("ChangeVenueStatus"),
            (req, ctx) => ChangeVenueStatus(req, ctx));
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

    public async Task<ListVenuesResponse> ListVenues(ListVenuesRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var status = ParseEnumOrNull<Domain.EventManagement.ValueObjects.VenueStatus>(req.Status);
        var venues = await _mediator.Send(
            new ListVenuesQuery(orgId, status, req.Skip, req.Take), ctx.CancellationToken);
        var resp = new ListVenuesResponse();
        resp.Venues.AddRange(venues.Select(VenueMessage.From));
        return resp;
    }

    public async Task<VenueMessage> AddVenue(AddVenueRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        if (req.Address is null || string.IsNullOrEmpty(req.Address.Country))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "address.country required"));

        var id = await _mediator.Send(new AddVenueCommand(
            orgId, req.Name, req.ClearDescription ? null : NullIfEmpty(req.Description),
            req.Address.Country,
            NullIfEmpty(req.Address.StreetLine1), NullIfEmpty(req.Address.StreetLine2),
            NullIfEmpty(req.Address.City), NullIfEmpty(req.Address.Region), NullIfEmpty(req.Address.PostalCode),
            req.Capacity > 0 ? req.Capacity : null,
            req.HasGeo ? req.Latitude : null,
            req.HasGeo ? req.Longitude : null), ctx.CancellationToken);

        var list = await _mediator.Send(
            new ListVenuesQuery(orgId, null, 0, 200), ctx.CancellationToken);
        var created = list.FirstOrDefault(v => v.Id == id)
            ?? throw new RpcException(new Status(StatusCode.Internal, "Venue created but not found"));
        return VenueMessage.From(created);
    }

    public async Task<VenueMessage> UpdateVenue(UpdateVenueRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var venueId = ParseGuid(req.VenueId, "venue_id");

        var address = req.Address;
        int? capacity = req.Capacity > 0 ? req.Capacity : null;
        double? lat = req.HasGeo ? req.Latitude : null;
        double? lng = req.HasGeo ? req.Longitude : null;

        await _mediator.Send(new UpdateVenueCommand(
            orgId, venueId,
            NullIfEmpty(req.Name), req.ClearDescription ? null : NullIfEmpty(req.Description),
            address?.Country,
            address?.StreetLine1, address?.StreetLine2,
            address?.City, address?.Region, address?.PostalCode,
            capacity, lat, lng, req.ClearGeo), ctx.CancellationToken);

        var list = await _mediator.Send(
            new ListVenuesQuery(orgId, null, 0, 200), ctx.CancellationToken);
        var updated = list.FirstOrDefault(v => v.Id == venueId)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Venue disappeared"));
        return VenueMessage.From(updated);
    }

    public async Task<VenueMessage> ChangeVenueStatus(ChangeVenueStatusRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var venueId = ParseGuid(req.VenueId, "venue_id");
        if (!Enum.TryParse<Application.EventManagement.Commands.VenueAction>(Capitalize(req.Action), out var action))
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Unknown venue action: {req.Action}"));
        await _mediator.Send(new ChangeVenueStatusCommand(orgId, venueId, action), ctx.CancellationToken);
        var list = await _mediator.Send(
            new ListVenuesQuery(orgId, null, 0, 200), ctx.CancellationToken);
        var updated = list.FirstOrDefault(v => v.Id == venueId)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Venue disappeared"));
        return VenueMessage.From(updated);
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
}

// ----- Raw message types (Phase 2 stand-in) -----

public class VenueMessage
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public VenueAddressMessage? Address { get; set; }
    public int Capacity { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool HasGeo { get; set; }
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;

    public static VenueMessage From(Domain.EventManagement.Aggregates.Venue v) => new()
    {
        Id = v.Id.ToString(),
        OrganizationId = v.OrganizationId.ToString(),
        Name = v.Name,
        Description = v.Description ?? string.Empty,
        Address = new VenueAddressMessage
        {
            Country = v.Address.Country,
            StreetLine1 = v.Address.StreetLine1 ?? string.Empty,
            StreetLine2 = v.Address.StreetLine2 ?? string.Empty,
            City = v.Address.City ?? string.Empty,
            Region = v.Address.Region ?? string.Empty,
            PostalCode = v.Address.PostalCode ?? string.Empty,
        },
        Capacity = v.Capacity.HasValue ? v.Capacity.Value.Value : 0,
        Latitude = v.Geo?.Latitude ?? 0,
        Longitude = v.Geo?.Longitude ?? 0,
        HasGeo = v.Geo is not null,
        Status = v.Status.ToString().ToLowerInvariant(),
        CreatedAt = v.CreatedAt.ToString("O"),
        UpdatedAt = v.UpdatedAt.ToString("O"),
    };
}

public class VenueAddressMessage
{
    public string Country { get; set; } = string.Empty;
    public string StreetLine1 { get; set; } = string.Empty;
    public string StreetLine2 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
}

public class ListVenuesRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int Skip { get; set; }
    public int Take { get; set; }
}

public class ListVenuesResponse
{
    public List<VenueMessage> Venues { get; set; } = new();
}

public class AddVenueRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public VenueAddressMessage? Address { get; set; }
    public int Capacity { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool HasGeo { get; set; }
    public bool ClearDescription { get; set; }
}

public class UpdateVenueRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string VenueId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public VenueAddressMessage? Address { get; set; }
    public int Capacity { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool HasGeo { get; set; }
    public bool ClearGeo { get; set; }
    public bool ClearDescription { get; set; }
}

public class ChangeVenueStatusRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string VenueId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
}
