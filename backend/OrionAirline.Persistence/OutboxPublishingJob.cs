using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace OrionAirline.Persistence;

public class OutboxPublishingJob : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OutboxPublishingJob> _logger;

    public OutboxPublishingJob(IServiceProvider serviceProvider, ILogger<OutboxPublishingJob> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Transactional Outbox Publisher started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
                var publishEndpoint = scope.ServiceProvider.GetRequiredService<IPublishEndpoint>();

                var pendingMessages = await dbContext.OutboxMessages
                    .Where(m => m.ProcessedOnUtc == null)
                    .OrderBy(m => m.OccurredOnUtc)
                    .Take(15)
                    .ToListAsync(stoppingToken);

                foreach (var message in pendingMessages)
                {
                    try
                    {
                        switch (message.EventType)
                        {
                            case "BookingCreatedEvent":
                                var bookingEvent = JsonConvert.DeserializeObject<BookingCreatedEvent>(message.EventPayload);
                                if (bookingEvent != null)
                                    await publishEndpoint.Publish(bookingEvent, stoppingToken);
                                break;
                            default:
                                _logger.LogWarning("Unknown event type: {Type}", message.EventType);
                                break;
                        }

                        message.ProcessedOnUtc = DateTime.UtcNow;
                        _logger.LogInformation("Published {Type} to RabbitMQ via MassTransit", message.EventType);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to publish event {Type}", message.EventType);
                    }
                }

                if (pendingMessages.Any())
                {
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing outbox");
            }

            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }
}
