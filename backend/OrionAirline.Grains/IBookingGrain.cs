using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Orleans;
using Orleans.Serialization;

namespace OrionAirline.Grains;

public interface IBookingGrain : IGrainWithStringKey
{
    Task<BookingDetails> CreateBookingAsync(string flightId, List<string> passengerIds, string seatNumber);
    Task<BookingDetails> ConfirmBookingAsync();
    Task<BookingDetails> CancelBookingAsync();
    Task<BookingDetails> ExpireBookingAsync();
    Task<BookingDetails> GetDetailsAsync();
}

[GenerateSerializer]
public enum BookingStatus
{
    [Id(0)] Pending,
    [Id(1)] Confirmed,
    [Id(2)] Cancelled,
    [Id(3)] Expired
}

[GenerateSerializer]
public record BookingDetails(
    [property: Id(0)] string BookingId,
    [property: Id(1)] string PNR,
    [property: Id(2)] string FlightId,
    [property: Id(3)] List<string> PassengerIds,
    [property: Id(4)] string SeatNumber,
    [property: Id(5)] BookingStatus Status,
    [property: Id(6)] DateTime CreatedAt
);
