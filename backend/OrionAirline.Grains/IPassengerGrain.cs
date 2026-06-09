using System.Threading.Tasks;
using Orleans;
using Orleans.Serialization;

namespace OrionAirline.Grains;

public interface IPassengerGrain : IGrainWithStringKey
{
    Task<PassengerProfile> RegisterAsync(string name, string passportNo, string contactInfo);
    Task<PassengerProfile> GetProfileAsync();
    Task<PassengerProfile> UpdateLoyaltyAsync(int pointsToAdd);
    Task AddBookingAsync(string bookingId);
}

[GenerateSerializer]
public record PassengerProfile(
    [property: Id(0)] string PassengerId,
    [property: Id(1)] string Name,
    [property: Id(2)] string PassportNumber,
    [property: Id(3)] string ContactInformation,
    [property: Id(4)] int LoyaltyPoints
);
