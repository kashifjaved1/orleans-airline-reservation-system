using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Orleans;
using OrionAirline.Grains;

namespace OrionAirline.Core.CQRS;

public class CreateBookingCommandHandler : IRequestHandler<CreateBookingCommand, BookingResponse>
{
    private readonly IGrainFactory _grainFactory;

    public CreateBookingCommandHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<BookingResponse> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        var bookingId = Guid.NewGuid().ToString("N")[..8];
        var bookingGrain = _grainFactory.GetGrain<IBookingGrain>(bookingId);

        var details = await bookingGrain.CreateBookingAsync(
            request.FlightId, request.PassengerIds, request.SeatNumber);

        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(request.FlightId);
        var lease = await flightGrain.BookSeatAsync(request.SeatNumber, request.PassengerIds[0]);

        if (!lease.Success)
        {
            await bookingGrain.CancelBookingAsync();
            return new BookingResponse(bookingId, string.Empty, request.FlightId,
                "Cancelled", "Seat conflict - concurrent booking blocked by Orleans.");
        }

        await bookingGrain.ConfirmBookingAsync();

        return new BookingResponse(bookingId, details.PNR, request.FlightId,
            "Confirmed", "Booking confirmed via Orleans actor.");
    }
}

public class CancelBookingCommandHandler : IRequestHandler<CancelBookingCommand, OperationResult>
{
    private readonly IGrainFactory _grainFactory;

    public CancelBookingCommandHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<OperationResult> Handle(CancelBookingCommand request, CancellationToken cancellationToken)
    {
        var bookingGrain = _grainFactory.GetGrain<IBookingGrain>(request.BookingId);
        var details = await bookingGrain.GetDetailsAsync();

        await bookingGrain.CancelBookingAsync();

        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(details.FlightId);
        await flightGrain.ReleaseSeatAsync(details.SeatNumber, "system");

        return new OperationResult(true, "Booking cancelled and seat released.");
    }
}

public class IssueTicketCommandHandler : IRequestHandler<IssueTicketCommand, TicketResponse>
{
    private readonly IGrainFactory _grainFactory;

    public IssueTicketCommandHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<TicketResponse> Handle(IssueTicketCommand request, CancellationToken cancellationToken)
    {
        var ticketNumber = $"TKT-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
        var ticketGrain = _grainFactory.GetGrain<ITicketGrain>(ticketNumber);

        var details = await ticketGrain.IssueTicketAsync(
            request.BookingId, request.PassengerId, request.FlightId, request.SeatNumber);

        return new TicketResponse(details.TicketNumber, details.BookingId, details.Status.ToString());
    }
}

public class CreatePassengerCommandHandler : IRequestHandler<CreatePassengerCommand, PassengerResponse>
{
    private readonly IGrainFactory _grainFactory;

    public CreatePassengerCommandHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<PassengerResponse> Handle(CreatePassengerCommand request, CancellationToken cancellationToken)
    {
        var passengerId = Guid.NewGuid().ToString("N")[..8];
        var passengerGrain = _grainFactory.GetGrain<IPassengerGrain>(passengerId);

        var profile = await passengerGrain.RegisterAsync(
            request.Name, request.PassportNumber, request.ContactInformation);

        return new PassengerResponse(profile.PassengerId, profile.Name, profile.PassportNumber);
    }
}

public class ReserveSeatCommandHandler : IRequestHandler<ReserveSeatCommand, BookingResult>
{
    private readonly IGrainFactory _grainFactory;

    public ReserveSeatCommandHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<BookingResult> Handle(ReserveSeatCommand request, CancellationToken cancellationToken)
    {
        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(request.FlightId);
        return await flightGrain.BookSeatAsync(request.SeatNumber, request.UserId);
    }
}

public class ReleaseSeatCommandHandler : IRequestHandler<ReleaseSeatCommand, OperationResult>
{
    private readonly IGrainFactory _grainFactory;

    public ReleaseSeatCommandHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<OperationResult> Handle(ReleaseSeatCommand request, CancellationToken cancellationToken)
    {
        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(request.FlightId);
        var result = await flightGrain.ReleaseSeatAsync(request.SeatNumber, "system");
        return new OperationResult(result.Success, result.Message);
    }
}

public class SearchFlightsQueryHandler : IRequestHandler<SearchFlightsQuery, List<FlightDto>>
{
    private readonly IGrainFactory _grainFactory;

    public SearchFlightsQueryHandler(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<List<FlightDto>> Handle(SearchFlightsQuery request, CancellationToken cancellationToken)
    {
        var results = new List<FlightDto>();
        var flightIds = new[] { "OR101", "OR202", "OR303", "OR404", "OR505" };

        foreach (var flightId in flightIds)
        {
            try
            {
                var flightGrain = _grainFactory.GetGrain<IFlightGrain>(flightId);
                var state = await flightGrain.GetStateAsync();
                results.Add(new FlightDto(
                    flightId, $"OR-{flightId[2..]}", "Airbus A350",
                    state.TotalSeats, state.AvailableSeats));
            }
            catch
            {
                results.Add(new FlightDto(flightId, $"OR-{flightId[2..]}", "Airbus A350", 102, 102));
            }
        }

        return results;
    }
}

public class QueryHandlers :
    IRequestHandler<GetFlightQuery, FlightDto>,
    IRequestHandler<GetBookingQuery, BookingDetailsDto>,
    IRequestHandler<GetPassengerQuery, PassengerProfileDto>,
    IRequestHandler<GetTicketQuery, TicketDto>
{
    private readonly IGrainFactory _grainFactory;

    public QueryHandlers(IGrainFactory grainFactory)
    {
        _grainFactory = grainFactory;
    }

    public async Task<FlightDto> Handle(GetFlightQuery request, CancellationToken cancellationToken)
    {
        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(request.FlightId);
        var state = await flightGrain.GetStateAsync();
        return new FlightDto(request.FlightId, "OR-902", "Airbus A350",
            state.TotalSeats, state.AvailableSeats);
    }

    public async Task<BookingDetailsDto> Handle(GetBookingQuery request, CancellationToken cancellationToken)
    {
        var bookingGrain = _grainFactory.GetGrain<IBookingGrain>(request.BookingId);
        var details = await bookingGrain.GetDetailsAsync();
        return new BookingDetailsDto(
            details.BookingId, details.PNR, details.FlightId,
            details.PassengerIds, details.SeatNumber, details.Status.ToString());
    }

    public async Task<PassengerProfileDto> Handle(GetPassengerQuery request, CancellationToken cancellationToken)
    {
        var passengerGrain = _grainFactory.GetGrain<IPassengerGrain>(request.PassengerId);
        var details = await passengerGrain.GetProfileAsync();
        return new PassengerProfileDto(
            details.PassengerId, details.Name, details.PassportNumber,
            details.ContactInformation, details.LoyaltyPoints);
    }

    public async Task<TicketDto> Handle(GetTicketQuery request, CancellationToken cancellationToken)
    {
        var ticketGrain = _grainFactory.GetGrain<ITicketGrain>(request.TicketNumber);
        var details = await ticketGrain.GetDetailsAsync();
        return new TicketDto(
            details.TicketNumber, details.BookingId, details.PassengerId,
            details.FlightId, details.SeatNumber, details.Status.ToString());
    }
}
