using Grpc.Core;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// RegistrationGrpcService — Phase 3 stub (I-301).
/// Real implementation sẽ override generated base class ở
/// SaasCheckin.Grpc.Ticketing.V1.TicketingServiceBase sau khi
/// `buf generate` chạy (I-303 / I-304). Phase 3 chỉ verify gRPC server
/// start được (map service ở Program.cs) và signature RPCs đã chốt.
/// </summary>
public sealed class RegistrationGrpcService
{
    /// <summary>Stub — sẽ override TicketingServiceBase.CreateOrder.</summary>
    public Task<string> CreateOrder(string organizationId, string eventId, string ticketTypeId, ServerCallContext context)
        => Task.FromResult(Guid.NewGuid().ToString());

    /// <summary>Stub — sẽ override TicketingServiceBase.MarkOrderPaid.</summary>
    public Task<bool> MarkOrderPaid(string organizationId, string orderId, string providerSessionId, ServerCallContext context)
        => Task.FromResult(true);
}
