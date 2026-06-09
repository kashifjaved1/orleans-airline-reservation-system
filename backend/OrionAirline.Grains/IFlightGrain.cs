using System.Threading.Tasks;
using Orleans;

namespace OrionAirline.Grains;

public interface IFlightGrain : IGrainWithStringKey
{
    Task<InitializeResult> InitializeAsync(int totalSeats);
    Task<BookingResult> BookSeatAsync(string seatNumber, string userId);
    Task<BookingResult> ReleaseSeatAsync(string seatNumber, string userId);
    Task<SeatStatus[]> GetSeatsAsync();
    Task<FlightState> GetStateAsync();
}

public record InitializeResult(bool Success, string Message);
public record BookingResult(bool Success, string SeatNumber, string UserId, string TraceId, string Message);
public record SeatStatus(string Number, string Status, string? UserId);
