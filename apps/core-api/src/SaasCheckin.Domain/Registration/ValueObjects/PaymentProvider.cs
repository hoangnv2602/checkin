namespace SaasCheckin.Domain.Registration.ValueObjects;

/// <summary>
/// PaymentProvider — chỉ liệt kê providers đã wire; D4 (D6 thêm sau).
/// Mở rộng thêm: thêm enum value, thêm adapter I-302 (api-gateway).
/// </summary>
public enum PaymentProvider
{
    Stripe = 0,
    Vnpay = 1
}
