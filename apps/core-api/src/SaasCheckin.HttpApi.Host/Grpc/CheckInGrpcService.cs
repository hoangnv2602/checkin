using Grpc.Core;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// CheckInGrpcService — Phase 0 stub.
/// Real implementation ở Phase 4 (I-401): Scan, GetEventStats, UndoCheckIn RPCs
/// từ packages/proto/checkin/v1/checkin.proto (cần chạy `buf generate` trước).
/// Phase 0 chỉ verify gRPC server start được (map service ở Program.cs).
/// </summary>
public sealed class CheckInGrpcService
{
    /// <summary>
    /// Echo method — tạm thời thay thế RPC. Sẽ override generated base class ở Phase 4.
    /// </summary>
    public Task<EchoResponse> Echo(EchoRequest request, ServerCallContext context)
    {
        return Task.FromResult(new EchoResponse { Message = $"echo: {request.Message}" });
    }
}

/// <summary>Phase 0 placeholder — sẽ bị xoá khi buf generate tạo proto types.</summary>
public sealed class EchoRequest
{
    public string Message { get; set; } = "";
}

public sealed class EchoResponse
{
    public string Message { get; set; } = "";
}
