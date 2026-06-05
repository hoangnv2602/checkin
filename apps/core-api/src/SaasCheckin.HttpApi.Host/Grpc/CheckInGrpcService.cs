using Grpc.Core;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// CheckInGrpcService — Phase 0 stub.
/// Real implementation ở Phase 4 (I-401): Scan, GetEventStats, UndoCheckIn RPCs
/// từ packages/proto/checkin/v1/checkin.proto.
/// Phase 0 chỉ verify gRPC server start được (map service ở Program.cs).
/// </summary>
public sealed class CheckInGrpcService : Proto.CheckInService.CheckInServiceBase
{
    public override Task<Proto.ScanResponse> Scan(
        Proto.ScanRequest request,
        ServerCallContext context)
    {
        // Phase 4: dispatch to CheckIn aggregate qua MediatR
        return Task.FromResult(new Proto.ScanResponse
        {
            Ok = false,
            Message = "Phase 0 stub",
        });
    }
}
