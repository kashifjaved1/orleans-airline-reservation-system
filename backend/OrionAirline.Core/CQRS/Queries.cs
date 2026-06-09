using System.Collections.Generic;
using MediatR;
using OrionAirline.Grains;

namespace OrionAirline.Core.CQRS;

// Queries
public record SearchFlightsQuery(
    string Origin, 
    string Destination, 
    string Date
) : IRequest<List<FlightDto>>;

public record GetFlightQuery(
    string FlightId
) : IRequest<FlightDto>;

public record GetBookingQuery(
    string BookingId
) : IRequest<BookingDetailsDto>;

public record GetPassengerQuery(
    string PassengerId
) : IRequest<PassengerProfileDto>;

public record GetTicketQuery(
    string TicketNumber
) : IRequest<TicketDto>;

// CQRS DTOs
public record FlightDto(
    string FlightId, 
    string FlightNumber, 
    string AircraftType, 
    int TotalSeats, 
    int AvailableSeats
);

public record BookingDetailsDto(
    string BookingId, 
    string PNR, 
    string FlightId, 
    List<string> PassengerIds, 
    string SeatNumber, 
    string Status
);

public record PassengerProfileDto(
    string PassengerId, 
    string Name, 
    string PassportNumber, 
    string ContactInformation, 
    int LoyaltyPoints
);

public record TicketDto(
    string TicketNumber, 
    string BookingId, 
    string PassengerId, 
    string FlightId, 
    string SeatNumber, 
    string Status
);
