using System.Threading.Tasks;
using Orleans;
using Orleans.Serialization;

namespace OrionAirline.Grains;

public interface ITicketGrain : IGrainWithStringKey
{
    Task<TicketDetails> IssueTicketAsync(string bookingId, string passengerId, string flightId, string seatNumber);
    Task<TicketDetails> CancelTicketAsync();
    Task<TicketDetails> ReissueTicketAsync(string newSeatNumber);
    Task<TicketDetails> GetDetailsAsync();
}

[GenerateSerializer]
public enum TicketStatus
{
    [Id(0)] Active,
    [Id(1)] Cancelled,
    [Id(2)] Reissued
}

[GenerateSerializer]
public record TicketDetails(
    [property: Id(0)] string TicketNumber,
    [property: Id(1)] string BookingId,
    [property: Id(2)] string PassengerId,
    [property: Id(3)] string FlightId,
    [property: Id(4)] string SeatNumber,
    [property: Id(5)] TicketStatus Status
);
