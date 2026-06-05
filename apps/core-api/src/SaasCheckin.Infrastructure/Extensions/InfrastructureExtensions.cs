using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.Interceptors;
using SaasCheckin.EntityFrameworkCore.Repositories;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    /// <summary>
    /// Register DbContext + repositories + RLS interceptor. Connection string
    /// key: <c>ConnectionStrings:Default</c>.
    /// </summary>
    public static IServiceCollection AddSaasCheckinDbContext(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:Default chưa được cấu hình trong appsettings.");

        services.AddDbContext<SaasCheckinDbContext>((sp, options) =>
        {
            options.UseNpgsql(connectionString, npg =>
            {
                npg.MigrationsAssembly(typeof(SaasCheckinDbContext).Assembly.FullName);
            });
            // RLS interceptor tự động wire mỗi khi connection open
            options.AddInterceptors(sp.GetRequiredService<TenantDbConnectionInterceptor>());
        });

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IMembershipRepository, MembershipRepository>();

        // Interceptor (singleton vì ICurrentTenant là singleton)
        services.AddSingleton<TenantDbConnectionInterceptor>();

        return services;
    }
}
