using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Orleans;
using OrionAirline.Core.CQRS;
using OrionAirline.Grains;
using OrionAirline.Persistence;

namespace OrionAirline.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Route("api/[controller]")]
[Authorize]
public class FlightsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IGrainFactory _grainFactory;
    private readonly RedisCacheService _cache;

    public FlightsController(IMediator mediator, IGrainFactory grainFactory, RedisCacheService cache)
    {
        _mediator = mediator;
        _grainFactory = grainFactory;
        _cache = cache;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(new SearchFlightsQuery("", "", ""));
        return Ok(result);
    }

    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<IActionResult> Search([FromQuery] string origin, [FromQuery] string destination, [FromQuery] string date)
    {
        var cacheKey = RedisCacheService.BuildFlightSearchKey(origin, destination, date);
        var cached = await _cache.GetAsync<List<FlightDto>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var result = await _mediator.Send(new SearchFlightsQuery(origin, destination, date));
        await _cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(5));

        return Ok(result);
    }

    [HttpGet("{flightId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFlight(string flightId)
    {
        var cacheKey = RedisCacheService.BuildFlightKey(flightId);
        var cached = await _cache.GetAsync<FlightDto>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var result = await _mediator.Send(new GetFlightQuery(flightId));
        await _cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(5));

        return Ok(result);
    }

    [HttpGet("{flightId}/seats")]
    public async Task<IActionResult> GetSeats(string flightId)
    {
        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(flightId);
        var seats = await flightGrain.GetSeatsAsync();
        return Ok(seats);
    }

    [HttpPost("{flightId}/initialize")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Initialize(string flightId, [FromQuery] int totalSeats = 102)
    {
        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(flightId);
        var result = await flightGrain.InitializeAsync(totalSeats);
        await _cache.RemoveAsync(RedisCacheService.BuildFlightKey(flightId));
        return Ok(result);
    }
}
