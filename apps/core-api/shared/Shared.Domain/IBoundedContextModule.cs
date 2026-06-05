using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SaasCheckin.Shared.Domain;

/// <summary>
/// IBoundedContextModule — DI registration cho mỗi bounded context.
/// Implement ở SaasCheckin.Domain.&lt;Context&gt;/&lt;Context&gt;Module.cs
/// rồi register ở SaasCheckin.HttpApi.Host/Program.cs qua
/// <c>app.AddBoundedContextModule&lt;IdentityModule&gt;();</c>
/// </summary>
public interface IBoundedContextModule
{
    string Name { get; }
    void Register(IServiceCollection services, IConfiguration configuration);
}
