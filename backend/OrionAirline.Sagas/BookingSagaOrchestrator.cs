using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Orleans;
using OrionAirline.Grains;
using OrionAirline.Persistence;
using System;
using System.Threading.Tasks;

namespace OrionAirline.Sagas;

public class BookingSagaOrchestrator
{
    private readonly IGrainFactory _grainFactory;
    private readonly BookingDbContext _dbContext;
    private readonly ILogger<BookingSagaOrchestrator> _logger;

    public BookingSagaOrchestrator(
        IGrainFactory grainFactory,
        BookingDbContext dbContext,
        ILogger<BookingSagaOrchestrator> logger)
    {
        _grainFactory = grainFactory;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<SagaResult> ExecuteBookingFlowAsync(
        string flightId, string seatNumber, string userId, string? passengerName = null)
    {
        string sagaId = Guid.NewGuid().ToString("N")[..8];
        _logger.LogInformation("Saga [{SagaId}] Starting booking flow: Flight={Flight}, Seat={Seat}, User={User}",
            sagaId, flightId, seatNumber, userId);

        bool seatReserved = false;
        Guid bookingId = Guid.NewGuid();
        string pnr = GeneratePnr();

        try
        {
            await LogSagaStep(sagaId, "SearchFlight", "Completed");

            var bookingGrain = _grainFactory.GetGrain<IBookingGrain>(bookingId.ToString("N")[..8]);
            var bookingDetails = await bookingGrain.CreateBookingAsync(flightId, new() { userId }, seatNumber);
            pnr = bookingDetails.PNR;
            await LogSagaStep(sagaId, "CreateBooking", "Completed");

            var flightGrain = _grainFactory.GetGrain<IFlightGrain>(flightId);
            var bookingResult = await flightGrain.BookSeatAsync(seatNumber, userId);

            if (!bookingResult.Success)
            {
                await bookingGrain.CancelBookingAsync();
                await LogSagaStep(sagaId, "ReserveSeat", "Failed");
                return new SagaResult(false, $"Seat {seatNumber} unavailable. Saga aborted.");
            }

            seatReserved = true;
            await LogSagaStep(sagaId, "ReserveSeat", "Completed");

            var confirmedDetails = await bookingGrain.ConfirmBookingAsync();
            await LogSagaStep(sagaId, "ConfirmBooking", "Completed");

            var ticketNumber = $"TKT-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
            var ticketGrain = _grainFactory.GetGrain<ITicketGrain>(ticketNumber);
            await ticketGrain.IssueTicketAsync(
                bookingDetails.BookingId, userId, flightId, seatNumber);
            await LogSagaStep(sagaId, "IssueTicket", "Completed");

            DbBooking dbBooking = new()
            {
                Id = bookingId,
                PNR = pnr,
                SeatNumber = seatNumber,
                UserId = userId,
                Status = "Confirmed",
                FlightId = flightId,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Bookings.Add(dbBooking);

            var outboxEvent = new
            {
                BookingId = bookingDetails.BookingId,
                PNR = pnr,
                FlightId = flightId,
                PassengerIds = new[] { userId },
                SeatNumber = seatNumber,
                CreatedAtUtc = DateTime.UtcNow
            };

            _dbContext.OutboxMessages.Add(new DbOutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = "BookingCreatedEvent",
                EventPayload = JsonConvert.SerializeObject(outboxEvent),
                OccurredOnUtc = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync();
            await LogSagaStep(sagaId, "SendNotification", "Completed");

            _logger.LogInformation("Saga [{SagaId}] COMPLETED: Booking {BookingId} confirmed. PNR={PNR}",
                sagaId, bookingId, pnr);

            var grainKey = bookingId.ToString("N")[..8];
            return new SagaResult(true, $"Booking confirmed. PNR: {pnr}", grainKey, pnr);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Saga [{SagaId}] FAILED. Running compensation...", sagaId);
            await CompensateAsync(sagaId, flightId, seatNumber, bookingId, seatReserved, pnr);
            return new SagaResult(false, $"Booking failed: {ex.Message}");
        }
    }

    private async Task CompensateAsync(
        string sagaId, string flightId, string seatNumber,
        Guid bookingId, bool releaseSeat, string pnr)
    {
        _logger.LogWarning("Saga [{SagaId}] Compensation started.", sagaId);

        if (releaseSeat)
        {
            try
            {
                var flightGrain = _grainFactory.GetGrain<IFlightGrain>(flightId);
                await flightGrain.ReleaseSeatAsync(seatNumber, "system");
                await LogSagaStep(sagaId, "ReleaseSeat", "Compensated");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Compensation: Failed to release seat {Seat}", seatNumber);
            }
        }

        try
        {
            var booking = await _dbContext.Bookings.FindAsync(bookingId);
            if (booking != null)
            {
                booking.Status = "Cancelled";
                _dbContext.OutboxMessages.Add(new DbOutboxMessage
                {
                    Id = Guid.NewGuid(),
                    EventType = "BookingCancelledEvent",
                    EventPayload = JsonConvert.SerializeObject(new { BookingId = bookingId, PNR = pnr }),
                    OccurredOnUtc = DateTime.UtcNow
                });
                await _dbContext.SaveChangesAsync();
                await LogSagaStep(sagaId, "CancelBooking", "Compensated");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Compensation: Failed to cancel booking {BookingId}", bookingId);
        }

        _logger.LogInformation("Saga [{SagaId}] Compensation completed.", sagaId);
    }

    private async Task LogSagaStep(string sagaId, string stepName, string status)
    {
        _dbContext.SagaLogs.Add(new DbSagaLog
        {
            Id = Guid.NewGuid(),
            SagaId = sagaId,
            StepName = stepName,
            Status = status,
            Timestamp = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();
    }

    private static string GeneratePnr()
    {
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        var result = new char[6];
        for (int i = 0; i < 6; i++)
            result[i] = chars[random.Next(chars.Length)];
        return new string(result);
    }
}

public record SagaResult(bool Success, string Message, string? BookingId = null, string? PNR = null);
