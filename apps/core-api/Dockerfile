# apps/core-api/Dockerfile — multi-stage Alpine build cho .NET 10

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./
COPY shared/ shared/
COPY src/ src/
COPY tests/ tests/
COPY SaasCheckin.sln .
RUN dotnet restore SaasCheckin.sln
RUN dotnet publish src/SaasCheckin.HttpApi.Host/SaasCheckin.HttpApi.Host.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app
COPY --from=build --chown=app:app /app/publish ./
USER app
EXPOSE 5000 50051
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "SaasCheckin.HttpApi.Host.dll"]
