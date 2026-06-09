using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Orleans;
using OrionAirline.Grains;

namespace OrionAirline.Persistence;

public record BookingCreatedEvent(
    string BookingId,
    string PNR,
    string FlightId,
    List<string> PassengerIds,
    string SeatNumber,
    DateTime CreatedAtUtc
);

public class BookingCreatedConsumer : IConsumer<BookingCreatedEvent>
{
    private readonly BookingDbContext _dbContext;
    private readonly IGrainFactory _grainFactory;
    private readonly ILogger<BookingCreatedConsumer> _logger;

    public BookingCreatedConsumer(
        BookingDbContext dbContext,
        IGrainFactory grainFactory,
        ILogger<BookingCreatedConsumer> logger)
    {
        _dbContext = dbContext;
        _grainFactory = grainFactory;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<BookingCreatedEvent> context)
    {
        var messageId = context.MessageId?.ToString() ?? Guid.NewGuid().ToString();
        var @event = context.Message;

        if (await IsMessageProcessedAsync(messageId))
        {
            _logger.LogInformation("Inbox: Duplicate message {MessageId} skipped", messageId);
            return;
        }

        _logger.LogInformation("Inbox: Processing BookingCreated {BookingId}", @event.BookingId);

        var inboxMessage = new DbInboxMessage
        {
            Id = Guid.NewGuid(),
            MessageId = messageId,
            EventType = nameof(BookingCreatedEvent),
            EventPayload = JsonConvert.SerializeObject(@event),
            ReceivedOnUtc = DateTime.UtcNow
        };
        _dbContext.InboxMessages.Add(inboxMessage);

        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(@event.FlightId);
        var seats = await flightGrain.GetSeatsAsync();

        _logger.LogInformation("Ticket Service: Notified for flight {FlightId}. Seats: {SeatCount}",
            @event.FlightId, seats.Length);

        inboxMessage.ProcessedOnUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
    }

    private async Task<bool> IsMessageProcessedAsync(string messageId)
    {
        return await _dbContext.InboxMessages.AnyAsync(m =>
            m.MessageId == messageId && m.ProcessedOnUtc != null);
    }
}
