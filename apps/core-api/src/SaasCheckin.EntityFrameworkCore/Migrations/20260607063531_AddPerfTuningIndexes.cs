using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaasCheckin.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class AddPerfTuningIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_audit_log_tenant_id_occurred_at_desc",
                table: "audit_log");

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_tenant_id_occurred_at",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_audit_log_tenant_id_occurred_at",
                table: "audit_log");

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_tenant_id_occurred_at_desc",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" },
                descending: new[] { false, true });
        }
    }
}
