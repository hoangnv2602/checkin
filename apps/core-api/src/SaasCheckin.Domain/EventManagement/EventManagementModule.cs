using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Domain.EventManagement;

/// <summary>
/// EventManagement bounded-context module (Phase 2, I-201).
/// </summary>
public sealed class EventManagementModule : IBoundedContextModule
{
    public string Name => "EventManagement";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // Repositories registered ở EntityFrameworkCore (cần DbContext).
    }
}
