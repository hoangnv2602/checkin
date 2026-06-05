using FluentAssertions;
using SaasCheckin.Domain.Registration.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Tests.Registration;

public class MoneyTests
{
    [Fact]
    public void Of_rejects_negative()
    {
        Action act = () => Money.Of(-1, "USD");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Of_rejects_non_3char_currency()
    {
        Action act = () => Money.Of(100, "DOLLAR");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Of_uppercases_currency()
    {
        var m = Money.Of(100, "usd");
        m.Currency.Should().Be("USD");
    }

    [Fact]
    public void Add_combines_same_currency()
    {
        Money.Of(100, "USD").Add(Money.Of(50, "USD")).AmountMinor.Should().Be(150);
    }

    [Fact]
    public void Add_rejects_currency_mismatch()
    {
        Action act = () => Money.Of(100, "USD").Add(Money.Of(50, "EUR"));
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Multiply_scales_amount()
    {
        Money.Of(100, "USD").Multiply(3).AmountMinor.Should().Be(300);
    }

    [Fact]
    public void Subtract_handles_underflow_to_zero()
    {
        Action act = () => Money.Of(100, "USD").Subtract(Money.Of(200, "USD"));
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void IsZero_distinguishes_zero_and_positive()
    {
        Money.Zero("USD").IsZero.Should().BeTrue();
        Money.Of(1, "USD").IsZero.Should().BeFalse();
    }
}
