using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaasCheckin.EntityFrameworkCore.Migrations
{
    /// <summary>
    /// Add user-scoped RLS policy on <c>memberships</c>: a user có thể SELECT
    /// rows có <c>user_id = current_setting('app.user_id')</c> regardless of
    /// <c>app.current_tenant</c>. Cần thiết cho login flow — khi user đăng
    /// nhập, chưa có tenant context (đang cần DISCOVER tenant), nên
    /// <c>memberships_tenant_isolation</c> chỉ trả về 0 rows.
    ///
    /// LoginCommandHandler giờ set <c>ICurrentTenant.UserId = user.Id</c>
    /// trước khi đọc memberships; TenantDbConnectionInterceptor set
    /// <c>app.user_id</c> lên mỗi EF connection.
    ///
    /// Multiple policies trên cùng bảng được OR — nên policy mới bổ sung
    /// cho policy cũ, không thay thế. Insert/Update vẫn phải pass
    /// <c>memberships_tenant_isolation</c> (WITH CHECK) — user không thể
    /// tự sửa memberships của mình qua connection khác tenant.
    /// </summary>
    public partial class AddMembershipSelfReadPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE POLICY memberships_self_read ON memberships
                    AS PERMISSIVE
                    FOR SELECT
                    USING (user_id::text = current_setting('app.user_id', true));
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP POLICY IF EXISTS memberships_self_read ON memberships;
            ");
        }
    }
}
