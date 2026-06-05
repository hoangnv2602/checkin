using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.HttpApi.Host.Middleware;

/// <summary>
/// Middleware extract <c>X-Tenant-Id</c> từ gRPC metadata hoặc HTTP header
/// rồi set <c>ICurrentTenant</c> cho cả request scope. EF Core RLS
/// interceptor (TenantDbConnectionInterceptor) sẽ đọc giá trị này lúc
/// mỗi connection.
///
/// Header name: <c>X-Tenant-Id</c> (HTTP + gRPC metadata).
/// Nếu header absent → <c>TenantId = null</c> (query global tables only).
/// </summary>
public sealed class CurrentTenantMiddleware
{
    public const string HeaderName = "X-Tenant-Id";
    public const string GrpcMetadataKey = "x-tenant-id";

    private readonly RequestDelegate _next;

    public CurrentTenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ICurrentTenant currentTenant)
    {
        // Try HTTP header first
        var tenantIdStr = context.Request.Headers[HeaderName].FirstOrDefault();

        // Fallback: gRPC metadata (nếu server đang xử lý gRPC request)
        if (string.IsNullOrEmpty(tenantIdStr) &&
            context.Request.Protocol.StartsWith("grpc", StringComparison.OrdinalIgnoreCase))
        {
            // gRPC metadata: gọi context.TraceIdentifier chứa headers, parse custom
            // Phase 1 đơn giản: HTTP gateway đã set X-Tenant-Id qua NestJS BFF.
        }

        if (!string.IsNullOrEmpty(tenantIdStr) && Guid.TryParse(tenantIdStr, out var tenantId))
        {
            currentTenant.SetTenant(tenantId);
        }

        try
        {
            await _next(context);
        }
        finally
        {
            // Reset cho request tiếp theo (tránh AsyncLocal leak trong test scenarios)
            currentTenant.SetTenant(null);
        }
    }
}
