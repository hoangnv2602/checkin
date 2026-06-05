using Microsoft.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connStr = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is required");

builder.Services.AddDbContext<SaasCheckinDbContext>(opt =>
    opt.UseNpgsql(connStr));

var app = builder.Build();

using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<SaasCheckinDbContext>();
var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

logger.LogInformation("Applying migrations to {Database}", db.Database.GetConnectionString());
await db.Database.MigrateAsync();
logger.LogInformation("✓ Migrations applied");

await app.RunAsync();
