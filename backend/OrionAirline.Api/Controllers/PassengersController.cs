using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Orleans;
using OrionAirline.Core.CQRS;
using OrionAirline.Grains;

namespace OrionAirline.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Route("api/[controller]")]
[Authorize]
public class PassengersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IGrainFactory _grainFactory;

    public PassengersController(IMediator mediator, IGrainFactory grainFactory)
    {
        _mediator = mediator;
        _grainFactory = grainFactory;
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] CreatePassengerCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpGet("{passengerId}")]
    public async Task<IActionResult> GetProfile(string passengerId)
    {
        var result = await _mediator.Send(new GetPassengerQuery(passengerId));
        return Ok(result);
    }

    [HttpPost("{passengerId}/loyalty")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateLoyalty(string passengerId, [FromQuery] int points)
    {
        var passengerGrain = _grainFactory.GetGrain<IPassengerGrain>(passengerId);
        var result = await passengerGrain.UpdateLoyaltyAsync(points);
        return Ok(result);
    }
}
