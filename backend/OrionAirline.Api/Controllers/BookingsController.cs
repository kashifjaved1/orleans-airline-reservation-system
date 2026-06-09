using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Orleans;
using OrionAirline.Core.CQRS;
using OrionAirline.Grains;
using OrionAirline.Persistence;
using OrionAirline.Sagas;

namespace OrionAirline.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Route("api/[controller]")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly BookingSagaOrchestrator _saga;
    private readonly RedisCacheService _cache;

    public BookingsController(IMediator mediator, BookingSagaOrchestrator saga, RedisCacheService cache)
    {
        _mediator = mediator;
        _saga = saga;
        _cache = cache;
    }

    [HttpPost]
    [Authorize(Policy = "CustomerOrAbove")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingCommand command)
    {
        var result = await _saga.ExecuteBookingFlowAsync(
            command.FlightId, command.SeatNumber, command.PassengerIds.FirstOrDefault() ?? "unknown");

        if (result.Success)
            return Ok(result);

        return Conflict(result);
    }

    [HttpPost("{bookingId}/cancel")]
    [Authorize(Policy = "CustomerOrAbove")]
    public async Task<IActionResult> CancelBooking(string bookingId)
    {
        var result = await _mediator.Send(new CancelBookingCommand(bookingId));
        await _cache.RemoveAsync(RedisCacheService.BuildBookingKey(bookingId));
        return Ok(result);
    }

    [HttpGet("{bookingId}")]
    [Authorize(Policy = "CustomerOrAbove")]
    public async Task<IActionResult> GetBooking(string bookingId)
    {
        var cacheKey = RedisCacheService.BuildBookingKey(bookingId);
        var cached = await _cache.GetAsync<BookingDetailsDto>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var result = await _mediator.Send(new GetBookingQuery(bookingId));
        await _cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(10));

        return Ok(result);
    }

    [HttpPost("direct")]
    public async Task<IActionResult> DirectBookSeat(string flightId, [FromBody] BookingRequest request)
    {
        var flightGrain = HttpContext.RequestServices.GetRequiredService<IGrainFactory>()
            .GetGrain<IFlightGrain>(flightId);

        var result = await flightGrain.BookSeatAsync(request.SeatNumber, request.UserId);

        if (result.Success)
            return Ok(result);

        return Conflict(result);
    }

    [HttpGet("flight/{flightId}/seats")]
    public async Task<IActionResult> GetSeats(string flightId)
    {
        var flightGrain = HttpContext.RequestServices.GetRequiredService<IGrainFactory>()
            .GetGrain<IFlightGrain>(flightId);

        var seats = await flightGrain.GetSeatsAsync();
        return Ok(seats);
    }

    [HttpPost("flight/{flightId}/reset")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ResetFlight(string flightId, [FromQuery] int totalSeats = 102)
    {
        var flightGrain = HttpContext.RequestServices.GetRequiredService<IGrainFactory>()
            .GetGrain<IFlightGrain>(flightId);

        var result = await flightGrain.InitializeAsync(totalSeats);
        return Ok(result);
    }
}

public record BookingRequest(string SeatNumber, string UserId);
