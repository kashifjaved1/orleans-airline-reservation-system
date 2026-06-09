using System;
using System.Threading.Tasks;
using Orleans;
using Orleans.Providers;
using Orleans.Serialization;

namespace OrionAirline.Grains;

[StorageProvider(ProviderName = "TicketStateStore")]
public class TicketGrain : Grain<TicketState>, ITicketGrain
{
    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(State.TicketNumber))
        {
            State.Status = TicketStatus.Cancelled;
            await WriteStateAsync();
        }
        await base.OnActivateAsync(cancellationToken);
    }

    public async Task<TicketDetails> IssueTicketAsync(string bookingId, string passengerId, string flightId, string seatNumber)
    {
        State.TicketNumber = $"TKT-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
        State.BookingId = bookingId;
        State.PassengerId = passengerId;
        State.FlightId = flightId;
        State.SeatNumber = seatNumber;
        State.Status = TicketStatus.Active;
        State.IssuedAtUtc = DateTime.UtcNow;

        await WriteStateAsync();

        return MapToDetails();
    }

    public async Task<TicketDetails> CancelTicketAsync()
    {
        if (string.IsNullOrEmpty(State.TicketNumber))
            throw new InvalidOperationException("Ticket not found.");

        State.Status = TicketStatus.Cancelled;
        State.CancelledAtUtc = DateTime.UtcNow;
        await WriteStateAsync();

        return MapToDetails();
    }

    public async Task<TicketDetails> ReissueTicketAsync(string newSeatNumber)
    {
        if (string.IsNullOrEmpty(State.TicketNumber))
            throw new InvalidOperationException("Ticket not found.");

        State.Status = TicketStatus.Reissued;
        State.SeatNumber = newSeatNumber;
        await WriteStateAsync();

        return MapToDetails();
    }

    public Task<TicketDetails> GetDetailsAsync()
    {
        if (string.IsNullOrEmpty(State.TicketNumber))
            throw new InvalidOperationException("Ticket not found.");

        return Task.FromResult(MapToDetails());
    }

    private TicketDetails MapToDetails()
    {
        return new TicketDetails(
            State.TicketNumber,
            State.BookingId,
            State.PassengerId,
            State.FlightId,
            State.SeatNumber,
            State.Status
        );
    }
}

[GenerateSerializer]
public class TicketState
{
    [Id(0)] public string TicketNumber { get; set; } = string.Empty;
    [Id(1)] public string BookingId { get; set; } = string.Empty;
    [Id(2)] public string PassengerId { get; set; } = string.Empty;
    [Id(3)] public string FlightId { get; set; } = string.Empty;
    [Id(4)] public string SeatNumber { get; set; } = string.Empty;
    [Id(5)] public TicketStatus Status { get; set; } = TicketStatus.Cancelled;
    [Id(6)] public DateTime IssuedAtUtc { get; set; }
    [Id(7)] public DateTime? CancelledAtUtc { get; set; }
}
