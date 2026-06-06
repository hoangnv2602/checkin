// apps/core-api/src/SaasCheckin.EntityFrameworkCore.Tests/ReadReplicaProviderTests.cs
// I-805 — Unit test cho ReadReplicaDbContextProvider fallback logic.
// (Integration test với Postgres replica ở perf/ folder.)
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using SaasCheckin.EntityFrameworkCore;

namespace SaasCheckin.EntityFrameworkCore.Tests;

public class ReadReplicaProviderTests
{
    [Fact]
    public void GetReadContext_FallbackToWrite_WhenReplicaConnectionEmpty()
    {
        Environment.SetEnvironmentVariable("DATABASE__READONLY_CONNECTION", null);
        var provider = new ReadReplicaDbContextProvider(
            new ServiceProviderStub(),
            NullLogger<ReadReplicaDbContextProvider>.Instance);

        var ctx = provider.GetReadContext();
        ctx.Should().NotBeNull();
        // Empty replica conn → fallback to write context.
        provider.IsReplicaAvailableAsync().GetAwaiter().GetResult().Should().BeFalse();
    }

    [Fact]
    public void ReplicaLag_NullInitially()
    {
        var provider = new ReadReplicaDbContextProvider(
            new ServiceProviderStub(),
            NullLogger<ReadReplicaDbContextProvider>.Instance);
        provider.ReplicaLag.Should().BeNull();
    }
}

internal sealed class ServiceProviderStub : IServiceProvider
{
    public object? GetService(Type serviceType) => null;
}
