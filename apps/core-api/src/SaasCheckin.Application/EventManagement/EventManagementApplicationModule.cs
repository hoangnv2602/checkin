using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Application.EventManagement.Commands;
using SaasCheckin.Application.EventManagement.Queries;
using SaasCheckin.Domain.EventManagement;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Application.EventManagement;

/// <summary>
/// EventManagement Application-layer registration (Phase 2, I-201).
///
/// Registers all MediatR handlers (commands + queries) for Event, Session, Venue.
/// Repository implementations wired in EntityFrameworkCore (cần DbContext).
/// Stateless library available for explicit state-machine composition (DI optional
/// vì state machine là per-aggregate instance).
/// </summary>
public sealed class EventManagementApplicationModule : IBoundedContextModule
{
    public string Name => "EventManagement.Application";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // MediatR auto-discovers handlers trong assembly này khi AddMediatR() được
        // gọi ở composition root, nên không cần explicit registration.
        // Module marker giúp bounded-context registration ở HttpApi.Host.
    }
}
