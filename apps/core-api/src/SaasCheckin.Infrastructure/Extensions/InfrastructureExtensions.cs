using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.Interceptors;
using SaasCheckin.EntityFrameworkCore.PlatformOperations.Repositories;
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

        // I-805: Read replica DbContext (chỉ register nếu có DATABASE__READONLY_CONNECTION
        // — dev mặc định không có, provider sẽ fallback primary).
        var readonlyConnection = configuration.GetConnectionString("ReadOnly")
            ?? Environment.GetEnvironmentVariable("DATABASE__READONLY_CONNECTION")
            ?? Environment.GetEnvironmentVariable("DATABASE_READONLY_CONNECTION");
        if (!string.IsNullOrEmpty(readonlyConnection))
        {
            services.AddDbContext<SaasCheckinReadDbContext>((sp, options) =>
            {
                options.UseNpgsql(readonlyConnection);
                options.AddInterceptors(sp.GetRequiredService<TenantDbConnectionInterceptor>());
            });
        }
        services.AddSingleton<IDbContextProvider, ReadReplicaDbContextProvider>();

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IMembershipRepository, MembershipRepository>();
        // I-107: Platform admin repositories
        services.AddScoped<IPlatformUserRepository, PlatformUserRepository>();
        services.AddScoped<IPlatformSessionRepository, PlatformSessionRepository>();

        // Interceptor (singleton vì ICurrentTenant là singleton)
        services.AddSingleton<TenantDbConnectionInterceptor>();

        return services;
    }
}
