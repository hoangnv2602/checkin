// apps/core-api/src/SaasCheckin.EntityFrameworkCore/IDbContextProvider.cs
// I-805 — Provider chọn DbContext theo loại truy vấn.
//
// Pattern: repository constructor request interface cụ thể:
//   - IWriteRepository → SaasCheckinDbContext (primary)
//   - IReadRepository  → SaasCheckinReadDbContext (replica, fallback primary nếu down)
using Microsoft.EntityFrameworkCore;

namespace SaasCheckin.EntityFrameworkCore;

public interface IDbContextProvider
{
    DbContext GetWriteContext();
    DbContext GetReadContext();
    Task<bool> IsReplicaAvailableAsync(CancellationToken ct = default);
    TimeSpan? ReplicaLag { get; }
}
