using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Domain.EventManagement;

/// <summary>
/// EventManagement bounded-context module (Phase 2, I-201).
///
/// Aggregate roots:
///   - Event     (draft → published → cancelled → completed)
///   - Session   (draft → scheduled → started → ended | cancelled)
///   - Venue     (active → inactive | archived)
///
/// Repositories registered ở EntityFrameworkCore (cần DbContext).
/// </summary>
public sealed class EventManagementModule : IBoundedContextModule
{
    public string Name => "EventManagement";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // Repository implementations wired in EntityFrameworkCore layer.
    }
}
