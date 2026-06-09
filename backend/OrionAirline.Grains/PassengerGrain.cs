using System;
using System.Threading.Tasks;
using Orleans;
using Orleans.Providers;
using Orleans.Serialization;

namespace OrionAirline.Grains;

[StorageProvider(ProviderName = "PassengerStateStore")]
public class PassengerGrain : Grain<PassengerState>, IPassengerGrain
{
    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(State.PassengerId))
        {
            State.LoyaltyPoints = 0;
            State.BookingIds = new System.Collections.Generic.List<string>();
            await WriteStateAsync();
        }
        await base.OnActivateAsync(cancellationToken);
    }

    public async Task<PassengerProfile> RegisterAsync(string name, string passportNo, string contactInfo)
    {
        State.PassengerId = this.GetPrimaryKeyString();
        State.Name = name;
        State.PassportNumber = passportNo;
        State.ContactInformation = contactInfo;
        State.LoyaltyPoints = 0;
        State.BookingIds = new System.Collections.Generic.List<string>();

        await WriteStateAsync();

        return MapToProfile();
    }

    public Task<PassengerProfile> GetProfileAsync()
    {
        if (string.IsNullOrEmpty(State.PassengerId))
            throw new InvalidOperationException("Passenger profile not found.");

        return Task.FromResult(MapToProfile());
    }

    public async Task<PassengerProfile> UpdateLoyaltyAsync(int pointsToAdd)
    {
        if (string.IsNullOrEmpty(State.PassengerId))
            throw new InvalidOperationException("Passenger profile not found.");

        State.LoyaltyPoints += pointsToAdd;
        await WriteStateAsync();

        return MapToProfile();
    }

    public async Task AddBookingAsync(string bookingId)
    {
        if (!State.BookingIds.Contains(bookingId))
        {
            State.BookingIds.Add(bookingId);
            await WriteStateAsync();
        }
    }

    private PassengerProfile MapToProfile()
    {
        return new PassengerProfile(
            State.PassengerId,
            State.Name,
            State.PassportNumber,
            State.ContactInformation,
            State.LoyaltyPoints
        );
    }
}

[GenerateSerializer]
public class PassengerState
{
    [Id(0)] public string PassengerId { get; set; } = string.Empty;
    [Id(1)] public string Name { get; set; } = string.Empty;
    [Id(2)] public string PassportNumber { get; set; } = string.Empty;
    [Id(3)] public string ContactInformation { get; set; } = string.Empty;
    [Id(4)] public int LoyaltyPoints { get; set; }
    [Id(5)] public System.Collections.Generic.List<string> BookingIds { get; set; } = new();
}
