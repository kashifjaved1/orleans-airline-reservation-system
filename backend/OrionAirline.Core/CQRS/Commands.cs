using System;
using System.Collections.Generic;
using MediatR;
using OrionAirline.Grains;

namespace OrionAirline.Core.CQRS;

// Commands
public record CreateBookingCommand(
    string FlightId, 
    List<string> PassengerIds, 
    string SeatNumber
) : IRequest<BookingResponse>;

public record CancelBookingCommand(
    string BookingId
) : IRequest<OperationResult>;

public record ReserveSeatCommand(
    string FlightId, 
    string SeatNumber, 
    string UserId
) : IRequest<BookingResult>;

public record ReleaseSeatCommand(
    string FlightId, 
    string SeatNumber
) : IRequest<OperationResult>;

public record IssueTicketCommand(
    string BookingId, 
    string PassengerId, 
    string FlightId, 
    string SeatNumber
) : IRequest<TicketResponse>;

public record CreatePassengerCommand(
    string Name, 
    string PassportNumber, 
    string ContactInformation
) : IRequest<PassengerResponse>;

// Common Responses
public record BookingResponse(
    string BookingId, 
    string PNR, 
    string FlightId, 
    string Status, 
    string Message
);

public record TicketResponse(
    string TicketNumber, 
    string BookingId, 
    string Status
);

public record PassengerResponse(
    string PassengerId, 
    string Name, 
    string PassportNumber
);

public record OperationResult(
    bool Success, 
    string Message
);
