using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Orleans;
using Orleans.Providers;
using Orleans.Runtime;
using Orleans.Serialization;

namespace OrionAirline.Grains;

[StorageProvider(ProviderName = "FlightStateStore")]
public class FlightGrain : Grain<FlightState>, IFlightGrain
{
    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        if (State.Seats == null || State.Seats.Count == 0)
        {
            await InitializeAsync(102);
        }
        await base.OnActivateAsync(cancellationToken);
    }

    public async Task<InitializeResult> InitializeAsync(int totalSeats)
    {
        State.TotalSeats = totalSeats;
        State.Seats = new Dictionary<string, SeatStatus>();

        string[] rows = { "A", "B", "C", "D", "E", "F" };
        int count = 0;
        for (int r = 1; r <= 17 && count < totalSeats; r++)
        {
            foreach (var rowLetter in rows)
            {
                if (count < totalSeats)
                {
                    string seatNumber = $"{r}{rowLetter}";
                    State.Seats[seatNumber] = new SeatStatus(seatNumber, "available", null);
                    count++;
                }
            }
        }

        await WriteStateAsync();
        return new InitializeResult(true, $"Flight initialized with {totalSeats} seats.");
    }

    public async Task<BookingResult> BookSeatAsync(string seatNumber, string userId)
    {
        string traceId = $"00-{Guid.NewGuid():N}";

        if (!State.Seats.TryGetValue(seatNumber, out var seat))
        {
            return new BookingResult(false, seatNumber, userId, traceId, "Seat does not exist.");
        }

        if (seat.Status == "available")
        {
            State.Seats[seatNumber] = new SeatStatus(seatNumber, "reserved", userId);
            State.AvailableSeats = State.Seats.Values.Count(s => s.Status == "available");
            State.ReservedSeats = State.Seats.Values.Count(s => s.Status == "reserved");
            await WriteStateAsync();

            return new BookingResult(
                Success: true,
                SeatNumber: seatNumber,
                UserId: userId,
                TraceId: traceId,
                Message: "Seat reserved successfully.");
        }

        return new BookingResult(
            Success: false,
            SeatNumber: seatNumber,
            UserId: userId,
            TraceId: traceId,
            Message: "Seat already reserved.");
    }

    public async Task<BookingResult> ReleaseSeatAsync(string seatNumber, string userId)
    {
        if (!State.Seats.TryGetValue(seatNumber, out var seat))
        {
            return new BookingResult(false, seatNumber, userId, "", "Seat does not exist.");
        }

        State.Seats[seatNumber] = new SeatStatus(seatNumber, "available", null);
        State.AvailableSeats = State.Seats.Values.Count(s => s.Status == "available");
        State.ReservedSeats = State.Seats.Values.Count(s => s.Status == "reserved");
        await WriteStateAsync();

        return new BookingResult(true, seatNumber, userId, "", "Seat released.");
    }

    public Task<SeatStatus[]> GetSeatsAsync()
    {
        return Task.FromResult(State.Seats.Values.ToArray());
    }

    public Task<FlightState> GetStateAsync()
    {
        return Task.FromResult(State);
    }
}

[GenerateSerializer]
public class FlightState
{
    [Id(0)] public int TotalSeats { get; set; }
    [Id(1)] public int AvailableSeats { get; set; }
    [Id(2)] public int ReservedSeats { get; set; }
    [Id(3)] public Dictionary<string, SeatStatus> Seats { get; set; } = new();
}
