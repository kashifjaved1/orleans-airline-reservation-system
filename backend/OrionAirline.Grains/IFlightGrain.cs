using System.Threading.Tasks;
using Orleans;
using Orleans.Serialization;

namespace OrionAirline.Grains;

public interface IFlightGrain : IGrainWithStringKey
{
    Task<InitializeResult> InitializeAsync(int totalSeats);
    Task<BookingResult> BookSeatAsync(string seatNumber, string userId);
    Task<BookingResult> ReleaseSeatAsync(string seatNumber, string userId);
    Task<SeatStatus[]> GetSeatsAsync();
    Task<FlightState> GetStateAsync();
}

[GenerateSerializer]
public record InitializeResult(
    [property: Id(0)] bool Success,
    [property: Id(1)] string Message);

[GenerateSerializer]
public record BookingResult(
    [property: Id(0)] bool Success,
    [property: Id(1)] string SeatNumber,
    [property: Id(2)] string UserId,
    [property: Id(3)] string TraceId,
    [property: Id(4)] string Message);

[GenerateSerializer]
public record SeatStatus(
    [property: Id(0)] string Number,
    [property: Id(1)] string Status,
    [property: Id(2)] string? UserId);
