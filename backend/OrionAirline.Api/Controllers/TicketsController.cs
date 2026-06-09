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
public class TicketsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IGrainFactory _grainFactory;

    public TicketsController(IMediator mediator, IGrainFactory grainFactory)
    {
        _mediator = mediator;
        _grainFactory = grainFactory;
    }

    [HttpPost]
    public async Task<IActionResult> IssueTicket([FromBody] IssueTicketCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpGet("{ticketNumber}")]
    public async Task<IActionResult> GetTicket(string ticketNumber)
    {
        var result = await _mediator.Send(new GetTicketQuery(ticketNumber));
        return Ok(result);
    }

    [HttpPost("{ticketNumber}/cancel")]
    public async Task<IActionResult> CancelTicket(string ticketNumber)
    {
        var ticketGrain = _grainFactory.GetGrain<ITicketGrain>(ticketNumber);
        var result = await ticketGrain.CancelTicketAsync();
        return Ok(result);
    }

    [HttpPost("{ticketNumber}/reissue")]
    public async Task<IActionResult> ReissueTicket(string ticketNumber, [FromQuery] string newSeat)
    {
        var ticketGrain = _grainFactory.GetGrain<ITicketGrain>(ticketNumber);
        var result = await ticketGrain.ReissueTicketAsync(newSeat);
        return Ok(result);
    }
}
