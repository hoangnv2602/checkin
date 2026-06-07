// apps/core-api/src/SaasCheckin.Infrastructure/EventManagement/EventManagementInfrastructureModule.cs
//
// Phase 0 in-memory registrations for EventManagement bounded-context
// repositories. Mirrors the CheckInInfrastructureModule shape: an
// IBoundedContextModule that wires the repository interfaces to concrete
// impls at the composition root (Program.cs).
//
// Phase 2 (I-201 EF Core migration) will replace these in-memory stubs
// with EF Core-backed implementations living in
// SaasCheckin.EntityFrameworkCore.EventManagement, but the registration
// shape (DI contract) is preserved so handlers don't need to change.
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Infrastructure.EventManagement;

public sealed class EventManagementInfrastructureModule : IBoundedContextModule
{
    public string Name => "EventManagement.Infrastructure";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IEventRepository, InMemoryEventRepository>();
        services.AddScoped<ISessionRepository, InMemorySessionRepository>();
        services.AddScoped<IVenueRepository, InMemoryVenueRepository>();
    }
}
