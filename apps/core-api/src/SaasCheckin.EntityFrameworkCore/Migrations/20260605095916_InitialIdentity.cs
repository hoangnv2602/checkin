using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaasCheckin.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class InitialIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,");

            migrationBuilder.CreateTable(
                name: "memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    invited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_memberships", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "organizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    default_locale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "en"),
                    default_currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "USD"),
                    timezone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "UTC"),
                    plan_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "citext", nullable: false),
                    email_verified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    full_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    avatar_url = table.Column<string>(type: "text", nullable: true),
                    locale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    last_login_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    locked_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    failed_login_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_memberships_tenant_id",
                table: "memberships",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_memberships_tenant_id_user_id",
                table: "memberships",
                columns: new[] { "tenant_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_memberships_user_id",
                table: "memberships",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_organizations_slug",
                table: "organizations",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);

            // ---- RLS (Row-Level Security) trên memberships ----
            // Multi-tenant isolation: chỉ rows có tenant_id = current_setting('app.current_tenant') mới visible.
            // app_runtime sẽ bị filter. app_platform_owner (BYPASSRLS) thấy tất cả.
            migrationBuilder.Sql(@"
                ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
                ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

                CREATE POLICY memberships_tenant_isolation ON memberships
                    USING (tenant_id::text = current_setting('app.current_tenant', true))
                    WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
            ");

            // ---- Grants ----
            // app_runtime: SELECT/INSERT/UPDATE/DELETE, RLS filter áp dụng.
            // app_platform_owner: full access + BYPASSRLS (đã có từ init.sql).
            migrationBuilder.Sql(@"
                GRANT USAGE ON SCHEMA public TO app_runtime, app_platform_owner;

                GRANT SELECT, INSERT, UPDATE, DELETE
                    ON organizations, users, memberships
                    TO app_runtime;

                GRANT SELECT, INSERT, UPDATE, DELETE
                    ON organizations, users, memberships
                    TO app_platform_owner;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP POLICY IF EXISTS memberships_tenant_isolation ON memberships;");
            migrationBuilder.Sql("ALTER TABLE IF EXISTS memberships NO FORCE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE IF EXISTS memberships DISABLE ROW LEVEL SECURITY;");

            migrationBuilder.DropTable(
                name: "memberships");

            migrationBuilder.DropTable(
                name: "organizations");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
