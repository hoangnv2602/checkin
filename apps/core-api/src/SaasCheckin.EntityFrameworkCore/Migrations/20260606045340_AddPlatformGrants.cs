using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaasCheckin.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // I-107: GRANT cho platform_users + platform_sessions.
            // app_runtime: dùng cho tenant-context calls (BFF) — full CRUD trên
            //              platform tables. RLS KHÔNG áp dụng (global tables, không
            //              có tenant_id) — chính sách phân quyền dựa vào app role
            //              (checkin-admin JWT ở layer trên).
            // app_platform_owner: full access + BYPASSRLS (đã có từ init.sql).
            migrationBuilder.Sql(@"
                GRANT SELECT, INSERT, UPDATE, DELETE
                    ON platform_users, platform_sessions
                    TO app_runtime;

                GRANT SELECT, INSERT, UPDATE, DELETE
                    ON platform_users, platform_sessions
                    TO app_platform_owner;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                REVOKE SELECT, INSERT, UPDATE, DELETE
                    ON platform_users, platform_sessions
                    FROM app_runtime;
                REVOKE SELECT, INSERT, UPDATE, DELETE
                    ON platform_users, platform_sessions
                    FROM app_platform_owner;
            ");
        }
    }
}
