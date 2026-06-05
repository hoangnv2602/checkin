// Tests/SaasCheckin.ArchitectureTests/IdentityBoundaryTests.cs
using FluentAssertions;
using NetArchTest.Rules;
using Xunit;

namespace SaasCheckin.ArchitectureTests;

/// <summary>
/// NetArchTest boundary checks — đảm bảo Identity bounded context tách biệt
/// theo DDD layered rules. Phase 1 I-105 commit 5.
/// </summary>
public class IdentityBoundaryTests
{
    private const string DomainNamespace = "SaasCheckin.Domain.Identity";
    private const string EfcNamespace = "SaasCheckin.EntityFrameworkCore.Identity";
    private const string ApplicationNamespace = "SaasCheckin.Application.Identity";
    private const string ApplicationContractsNamespace = "SaasCheckin.Application.Contracts.Identity";

    [Fact]
    public void identity_domain_should_not_depend_on_entity_framework_core()
    {
        var result = Types.InNamespace(DomainNamespace)
            .ShouldNot()
            .HaveDependencyOn(EfcNamespace)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Domain must not depend on EntityFrameworkCore. Violations: {string.Join(", ", result.FailingTypeNames ?? new System.Collections.Generic.List<string>())}");
    }

    [Fact]
    public void identity_domain_should_not_depend_on_application_layer()
    {
        var result = Types.InNamespace(DomainNamespace)
            .ShouldNot()
            .HaveDependencyOn(ApplicationNamespace)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Domain must not depend on Application. Violations: {string.Join(", ", result.FailingTypeNames ?? new System.Collections.Generic.List<string>())}");
    }

    [Fact]
    public void identity_application_should_not_depend_on_entity_framework_core()
    {
        var result = Types.InNamespace(ApplicationNamespace)
            .ShouldNot()
            .HaveDependencyOnAny("SaasCheckin.EntityFrameworkCore", "Microsoft.EntityFrameworkCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Application must not depend on EF Core. Violations: {string.Join(", ", result.FailingTypeNames ?? new System.Collections.Generic.List<string>())}");
    }

    [Fact]
    public void identity_application_contracts_should_not_depend_on_application()
    {
        var result = Types.InNamespace(ApplicationContractsNamespace)
            .ShouldNot()
            .HaveDependencyOn(ApplicationNamespace)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Application.Contracts must not depend on Application. Violations: {string.Join(", ", result.FailingTypeNames ?? new System.Collections.Generic.List<string>())}");
    }

    [Fact]
    public void aggregates_should_reside_in_aggregates_namespace()
    {
        var result = Types.InAssembly(typeof(SaasCheckin.Domain.Identity.Aggregates.User).Assembly)
            .That()
            .ResideInNamespace("SaasCheckin.Domain.Identity.Aggregates")
            .And()
            .AreClasses()
            .And()
            .HaveNameEndingWith("Aggregate")
            .Should()
            .HaveNameStartingWith("User")
            .Or()
            .HaveNameStartingWith("Organization")
            .Or()
            .HaveNameStartingWith("Membership")
            .GetResult();

        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void value_objects_should_reside_in_value_objects_namespace()
    {
        // Soft check: VOs are types in the ValueObjects namespace.
        var result = Types.InAssembly(typeof(SaasCheckin.Domain.Identity.Aggregates.User).Assembly)
            .That()
            .ResideInNamespace("SaasCheckin.Domain.Identity.ValueObjects")
            .Should()
            .BeClasses()
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Value objects should be classes. Violations: {string.Join(", ", result.FailingTypeNames ?? new System.Collections.Generic.List<string>())}");
    }
}
