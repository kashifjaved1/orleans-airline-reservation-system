using System.Threading.Tasks;
using Orleans;

namespace OrionAirline.Grains;

public interface ITicketGrain : IGrainWithStringKey
{
    Task<TicketDetails> IssueTicketAsync(string bookingId, string passengerId, string flightId, string seatNumber);
    Task<TicketDetails> CancelTicketAsync();
    Task<TicketDetails> ReissueTicketAsync(string newSeatNumber);
    Task<TicketDetails> GetDetailsAsync();
}

public enum TicketStatus
{
    Active,
    Cancelled,
    Reissued
}

public record TicketDetails(
    string TicketNumber,
    string BookingId,
    string PassengerId,
    string FlightId,
    string SeatNumber,
    TicketStatus Status
);
