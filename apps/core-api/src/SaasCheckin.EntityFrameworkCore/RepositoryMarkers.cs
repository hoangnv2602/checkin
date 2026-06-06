// apps/core-api/src/SaasCheckin.EntityFrameworkCore/RepositoryMarkers.cs
// I-805 — Marker interfaces cho repository routing.
//
// Convention:
//   - IReadRepository<T>  → resolve tới SaasCheckinReadDbContext (replica)
//   - IWriteRepository<T> → resolve tới SaasCheckinDbContext (primary)
namespace SaasCheckin.SharedKernel;

public interface IReadRepository<T> where T : class
{
    // Marker — không có method. Implementer sẽ inject IDbContextProvider.
}

public interface IWriteRepository<T> where T : class
{
    // Marker.
}
