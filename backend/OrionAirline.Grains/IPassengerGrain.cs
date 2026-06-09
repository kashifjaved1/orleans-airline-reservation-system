using System.Threading.Tasks;
using Orleans;

namespace OrionAirline.Grains;

public interface IPassengerGrain : IGrainWithStringKey
{
    Task<PassengerProfile> RegisterAsync(string name, string passportNo, string contactInfo);
    Task<PassengerProfile> GetProfileAsync();
    Task<PassengerProfile> UpdateLoyaltyAsync(int pointsToAdd);
    Task AddBookingAsync(string bookingId);
}

public record PassengerProfile(
    string PassengerId,
    string Name,
    string PassportNumber,
    string ContactInformation,
    int LoyaltyPoints
);
