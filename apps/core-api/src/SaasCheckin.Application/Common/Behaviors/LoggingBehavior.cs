using MediatR;
using Microsoft.Extensions.Logging;

namespace SaasCheckin.Application.Common.Behaviors;

public sealed class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var name = typeof(TRequest).Name;
        _logger.LogInformation("Handling {Request}", name);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var response = await next();
            sw.Stop();
            _logger.LogInformation("Handled {Request} in {Ms}ms", name, sw.ElapsedMilliseconds);
            return response;
        }
        catch
        {
            sw.Stop();
            _logger.LogWarning("Failed {Request} in {Ms}ms", name, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
