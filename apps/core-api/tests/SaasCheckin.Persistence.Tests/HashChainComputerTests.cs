// apps/core-api/tests/SaasCheckin.Persistence.Tests/HashChainComputerTests.cs
//
// I-908 — Unit tests cho HashChainComputer (no DB).
using FluentAssertions;
using SaasCheckin.EntityFrameworkCore.Audit;
using Xunit;

namespace SaasCheckin.Persistence.Tests;

public class HashChainComputerTests
{
    [Fact]
    public void Genesis_hash_is_64_zeros()
    {
        HashChainComputer.GenesisHash.Should().HaveLength(64);
        HashChainComputer.GenesisHash.Should().MatchRegex("^0+$");
    }

    [Fact]
    public void ComputeHash_is_deterministic()
    {
        var t = DateTimeOffset.UtcNow;
        var id = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var tid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var actor = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var h1 = HashChainComputer.ComputeHash(HashChainComputer.GenesisHash, id, tid, "test", actor, t);
        var h2 = HashChainComputer.ComputeHash(HashChainComputer.GenesisHash, id, tid, "test", actor, t);
        h1.Should().Be(h2);
    }

    [Fact]
    public void ComputeHash_changes_with_prev_hash()
    {
        var t = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var tid = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var h1 = HashChainComputer.ComputeHash(HashChainComputer.GenesisHash, id, tid, "a", actor, t);
        var h2 = HashChainComputer.ComputeHash("a".PadRight(64, '0'), id, tid, "a", actor, t);
        h1.Should().NotBe(h2);
    }

    [Fact]
    public void ComputeHash_changes_with_action()
    {
        var t = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var tid = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var h1 = HashChainComputer.ComputeHash(HashChainComputer.GenesisHash, id, tid, "create", actor, t);
        var h2 = HashChainComputer.ComputeHash(HashChainComputer.GenesisHash, id, tid, "update", actor, t);
        h1.Should().NotBe(h2);
    }

    [Fact]
    public void Verify_empty_chain_returns_no_breaks()
    {
        var breaks = HashChainComputer.Verify(Array.Empty<AuditChainRow>());
        breaks.Should().BeEmpty();
    }

    [Fact]
    public void Verify_valid_chain_passes()
    {
        var t = DateTimeOffset.UtcNow;
        var tid = Guid.NewGuid();
        var prev = HashChainComputer.GenesisHash;
        var rows = new List<AuditChainRow>();
        for (int i = 0; i < 5; i++)
        {
            var id = Guid.NewGuid();
            var actor = Guid.NewGuid();
            var h = HashChainComputer.ComputeHash(prev, id, tid, "action." + i, actor, t.AddSeconds(i));
            rows.Add(new AuditChainRow(id, tid, "action." + i, actor, t.AddSeconds(i), prev, h));
            prev = h;
        }
        var breaks = HashChainComputer.Verify(rows);
        breaks.Should().BeEmpty();
    }

    [Fact]
    public void Verify_detects_tampered_hash()
    {
        var t = DateTimeOffset.UtcNow;
        var tid = Guid.NewGuid();
        var prev = HashChainComputer.GenesisHash;
        var id1 = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var h1 = HashChainComputer.ComputeHash(prev, id1, tid, "a", actor, t);
        var id2 = Guid.NewGuid();
        var h2 = HashChainComputer.ComputeHash(h1, id2, tid, "b", actor, t.AddSeconds(1));
        var rows = new List<AuditChainRow>
        {
            new(id1, tid, "a", actor, t, prev, h1),
            new(id2, tid, "TAMPERED", actor, t.AddSeconds(1), h1, h2),  // action changed
        };
        var breaks = HashChainComputer.Verify(rows);
        breaks.Should().HaveCount(1);
        breaks[0].RowId.Should().Be(id2);
    }

    [Fact]
    public void Verify_detects_broken_prev_link()
    {
        var t = DateTimeOffset.UtcNow;
        var tid = Guid.NewGuid();
        var id1 = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var h1 = HashChainComputer.ComputeHash(HashChainComputer.GenesisHash, id1, tid, "a", actor, t);
        var id2 = Guid.NewGuid();
        var h2 = HashChainComputer.ComputeHash(h1, id2, tid, "b", actor, t.AddSeconds(1));
        // Row 2 has wrong prevHash
        var rows = new List<AuditChainRow>
        {
            new(id1, tid, "a", actor, t, HashChainComputer.GenesisHash, h1),
            new(id2, tid, "b", actor, t.AddSeconds(1), "deadbeef".PadRight(64, '0'), h2),
        };
        var breaks = HashChainComputer.Verify(rows);
        breaks.Should().HaveCount(1);
        breaks[0].Index.Should().Be(1);
    }
}
