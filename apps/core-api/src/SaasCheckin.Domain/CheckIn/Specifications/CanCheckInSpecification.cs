using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.Registration.Aggregates;

namespace SaasCheckin.Domain.CheckIn.Specifications;

/// <summary>
/// CanCheckInSpecification — check invariants trước khi tạo CheckInRecord
/// thành công:
///  1. Event phải live (Published + startAt &lt;= now &lt;= endAt)
///  2. Registration phải Active (chưa checked in / revoked / expired)
///  3. Chưa có record Success cho cùng Registration (DB partial unique index
///     cũng enforce — check ở app để fail fast với error message rõ ràng)
///  4. Gate phải thuộc venue của event (Phase 4: stub — chấp nhận mọi gate)
/// </summary>
public sealed class CanCheckInSpecification
{
    public bool IsSatisfiedBy(
        Event @event,
        Registration registration,
        IReadOnlyList<CheckInRecord> existingSuccess,
        DateTimeOffset now)
    {
        if (@event.Status != EventManagement.ValueObjects.EventStatus.Published)
            return false;
        if (now < @event.Period.StartAt || now > @event.Period.EndAt)
            return false;
        if (registration.Status != RegistrationStatus.Active)
            return false;
        if (existingSuccess.Count > 0)
            return false;
        return true;
    }
}
