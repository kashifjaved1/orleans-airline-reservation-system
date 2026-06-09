using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Orleans;

namespace OrionAirline.Grains;

public interface IBookingGrain : IGrainWithStringKey
{
    Task<BookingDetails> CreateBookingAsync(string flightId, List<string> passengerIds, string seatNumber);
    Task<BookingDetails> ConfirmBookingAsync();
    Task<BookingDetails> CancelBookingAsync();
    Task<BookingDetails> ExpireBookingAsync();
    Task<BookingDetails> GetDetailsAsync();
}

public enum BookingStatus
{
    Pending,
    Confirmed,
    Cancelled,
    Expired
}

public record BookingDetails(
    string BookingId,
    string PNR,
    string FlightId,
    List<string> PassengerIds,
    string SeatNumber,
    BookingStatus Status,
    DateTime CreatedAt
);
