using FluentValidation;
using System.Linq;

namespace OrionAirline.Core.CQRS;

public class CreateBookingCommandValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingCommandValidator()
    {
        RuleFor(x => x.FlightId)
            .NotEmpty().WithMessage("Flight ID must not be empty.");

        RuleFor(x => x.SeatNumber)
            .NotEmpty().WithMessage("Seat Number is required to initiate a lease claim.")
            .Matches(@"^[1-9][0-9]?[A-F]$").WithMessage("Seat number format is invalid (e.g. 1A, 17F).");

        RuleFor(x => x.PassengerIds)
            .NotEmpty().WithMessage("At least one passenger profile ID must be attached.");
    }
}

public class CreatePassengerCommandValidator : AbstractValidator<CreatePassengerCommand>
{
    public CreatePassengerCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Passenger legal name cannot be left blank.")
            .MinimumLength(3).WithMessage("Name should have at least 3 characters.");

        RuleFor(x => x.PassportNumber)
            .NotEmpty().WithMessage("Valid international passport credential number is required.");
    }
}
