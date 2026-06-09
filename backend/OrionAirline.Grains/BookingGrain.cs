using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Orleans;
using Orleans.Providers;

namespace OrionAirline.Grains;

[StorageProvider(ProviderName = "BookingStateStore")]
public class BookingGrain : Grain<BookingState>, IBookingGrain
{
    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(State.BookingId))
        {
            State.Status = BookingStatus.Pending;
            await WriteStateAsync();
        }
        await base.OnActivateAsync(cancellationToken);
    }

    public async Task<BookingDetails> CreateBookingAsync(string flightId, List<string> passengerIds, string seatNumber)
    {
        var pnr = GeneratePNR();
        State.BookingId = this.GetPrimaryKeyString();
        State.PNR = pnr;
        State.FlightId = flightId;
        State.PassengerIds = passengerIds;
        State.SeatNumber = seatNumber;
        State.Status = BookingStatus.Pending;
        State.CreatedAt = DateTime.UtcNow;

        await WriteStateAsync();

        return MapToDetails();
    }

    public async Task<BookingDetails> ConfirmBookingAsync()
    {
        ValidateState();
        ValidateTransition(BookingStatus.Pending);

        State.Status = BookingStatus.Confirmed;
        await WriteStateAsync();

        return MapToDetails();
    }

    public async Task<BookingDetails> CancelBookingAsync()
    {
        ValidateState();

        if (State.Status != BookingStatus.Pending && State.Status != BookingStatus.Confirmed)
            throw new InvalidOperationException($"Cannot cancel booking in status {State.Status}.");

        State.Status = BookingStatus.Cancelled;
        await WriteStateAsync();

        return MapToDetails();
    }

    public async Task<BookingDetails> ExpireBookingAsync()
    {
        ValidateState();
        State.Status = BookingStatus.Expired;
        await WriteStateAsync();
        return MapToDetails();
    }

    public Task<BookingDetails> GetDetailsAsync()
    {
        if (string.IsNullOrEmpty(State.BookingId))
            throw new InvalidOperationException("Booking not found.");

        return Task.FromResult(MapToDetails());
    }

    private void ValidateState()
    {
        if (string.IsNullOrEmpty(State.BookingId))
            throw new InvalidOperationException("Booking not initialized.");
    }

    private void ValidateTransition(BookingStatus expected)
    {
        if (State.Status != expected)
            throw new InvalidOperationException($"Cannot transition from {State.Status} to requested operation.");
    }

    private BookingDetails MapToDetails()
    {
        return new BookingDetails(
            State.BookingId,
            State.PNR,
            State.FlightId,
            State.PassengerIds,
            State.SeatNumber,
            State.Status,
            State.CreatedAt
        );
    }

    private static string GeneratePNR()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        var buffer = new char[6];
        for (int i = 0; i < 6; i++)
        {
            buffer[i] = chars[random.Next(chars.Length)];
        }
        return new string(buffer);
    }
}

public class BookingState
{
    public string BookingId { get; set; } = string.Empty;
    public string PNR { get; set; } = string.Empty;
    public string FlightId { get; set; } = string.Empty;
    public List<string> PassengerIds { get; set; } = new();
    public string SeatNumber { get; set; } = string.Empty;
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public DateTime CreatedAt { get; set; }
}
