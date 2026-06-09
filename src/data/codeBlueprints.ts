/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PhaseBlueprint } from "../types";

export const CODE_BLUEPRINTS: PhaseBlueprint[] = [
  {
    id: "phase1",
    title: "Phase 1: Architecture & Gateway",
    subtitle: "YARP Gateway Routing, Rate Limiting & Auth Configuration",
    summary: "Configures YARP (Yet Another Reverse Proxy) for request routing, OpenTelemetry tracking, Bearer Authentication, and Active Rate Limiting.",
    bestPractices: [
      "Use Active Directory or OpenID Connect token verification at the gateway level.",
      "Apply localized rate-limiting based on IP Address or User Identity Claim.",
      "Forward request trace context (W3C Trace Context) to downstream microservices."
    ],
    tradeoffs: [
      "Gateway Auth offloading simplifies downstream services but requires synchronized key rotation.",
      "Heavy rate limit state tracking on Redis adds ~2ms gateway overhead but prevents service exhaustion."
    ],
    scalability: "YARP routes and proxies requests at near-native socket speeds and can be scaled horizontally behind an NLB (Network Load Balancer).",
    failureScenarios: "If YARP loses connection to downstream clusters, YARP triggers Polly circuit breakers, returning custom 503 Service Unavailable instantly.",
    files: [
      {
        name: "YARP Gateway Settings",
        path: "Gateway/appsettings.json",
        language: "json",
        description: "YARP proxy configuration specifying routes, clusters, authentication policies, and rate-limiting rules.",
        content: `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ReverseProxy": {
    "Routes": {
      "flights-route": {
        "ClusterId": "flights-cluster",
        "Match": {
          "Path": "/api/v1/flights/{**catchall}"
        },
        "Transforms": [
          { "RequestHeaderOriginalHost": "true" },
          { "X-Forwarded": "Set" }
        ],
        "RateLimiterPolicy": "ConcurrencyLimiter",
        "AuthorizationPolicy": "Anonymous"
      },
      "bookings-route": {
        "ClusterId": "bookings-cluster",
        "Match": {
          "Path": "/api/v1/bookings/{**catchall}"
        },
        "Transforms": [
          { "RequestHeaderOriginalHost": "true" }
        ],
        "RateLimiterPolicy": "StrictLimiter",
        "AuthorizationPolicy": "SecurePolicy"
      }
    },
    "Clusters": {
      "flights-cluster": {
        "Destinations": {
          "flights-destination-1": {
            "Address": "http://flight-service:5000"
          },
          "flights-destination-2": {
            "Address": "http://flight-service-backup:5000"
          }
        },
        "LoadBalancingPolicy": "RoundRobin"
      },
      "bookings-cluster": {
        "Destinations": {
          "bookings-destination-1": {
            "Address": "http://booking-service:5010"
          }
        }
      }
    }
  }
}`
      },
      {
        name: "Program.cs (Gateway)",
        path: "Gateway/Program.cs",
        language: "csharp",
        description: "Core initialization loading YARP reverse proxy, token verification middleware, and correlation tracking.",
        content: `using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// OpenTelemetry & Tracing setup
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddJaegerExporter());

// JWT Auth Setup at Gateway
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer("SecurePolicy", options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SecurePolicy", policy => policy.RequireAuthenticatedUser());
});

// Configure Rate Limiting Policies
builder.Services.AddRateLimiter(options =>
{
    options.AddConcurrencyLimiter("ConcurrencyLimiter", opt =>
    {
        opt.PermitLimit = 1000;
        opt.QueueLimit = 200;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    options.AddFixedWindowLimiter("StrictLimiter", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromSeconds(1);
        opt.QueueLimit = 10;
    });
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.UseCorrelationIdMiddleware(); // Custom middleware to inject context headers
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapReverseProxy();

app.Run();`
      }
    ]
  },
  {
    id: "phase2",
    title: "Phase 2: DDD Modeling",
    subtitle: "Aggregates, Value Objects and Domain Events",
    summary: "Creates the architectural boundary of microservices based on domain-driven design aggregates and boundary contexts, defining rich Domain Events.",
    bestPractices: [
      "Ensure Aggregates enforce their invariants within consistency boundaries.",
      "Model entities as immutable wherever applicable using Record types.",
      "Publish Domain Events dynamically during DbContext save lifecycle."
    ],
    tradeoffs: [
      "Full DDD tracking raises initial EF complexity but makes state transitions audit-proof.",
      "Indirect aggregate updates over domain events increase latency but guarantee loose coupling."
    ],
    scalability: "Aggregates are cleanly mapped to self-contained SQL-databases, allowing independent write-scalability and database migrations.",
    failureScenarios: "Events are queued inside Outbox tables inside the same aggregate service transaction, ensuring zero loss on crashes.",
    files: [
      {
        name: "Aggregate Root & Entities",
        path: "Domain/Aggregates/Booking.cs",
        language: "csharp",
        description: "Aggregate root enforcing flight ticket status life cycles and seat safety invariants.",
        content: `using System;
using System.Collections.Generic;

namespace AirlineSystem.Domain.Aggregates;

public enum BookingStatus
{
    Pending,
    Confirmed,
    Cancelled,
    Expired
}

public class Booking : AggregateRoot
{
    public Guid Id { get; private set; }
    public string PNR { get; private set; } = string.Empty;
    public Guid FlightId { get; private set; }
    public BookingStatus Status { get; private set; }
    public Money TotalPrice { get; private set; } = Money.Zero;
    
    private readonly List<Passenger> _passengers = new();
    public IReadOnlyCollection<Passenger> Passengers => _passengers.AsReadOnly();
    public DateTime CreatedAt { get; private set; }

    private Booking() { } // EF Core Required

    public static Booking Create(Guid flightId, List<Passenger> passengers, Money price)
    {
        if (flightId == Guid.Empty) throw new ArgumentException("Invalid FlightId");
        if (passengers.Count == 0) throw new ArgumentException("Passengers are required");

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            FlightId = flightId,
            PNR = GeneratePNRCode(),
            Status = BookingStatus.Pending,
            TotalPrice = price,
            CreatedAt = DateTime.UtcNow
        };

        booking._passengers.AddRange(passengers);
        
        // Add Domain Event to trigger Saga or outbox checks
        booking.AddDomainEvent(new BookingCreatedEvent(booking.Id, flightId, booking.PNR));
        
        return booking;
    }

    public void Confirm()
    {
        if (Status != BookingStatus.Pending)
            throw new InvalidOperationException("Can only confirm pending bookings.");

        Status = BookingStatus.Confirmed;
        AddDomainEvent(new BookingConfirmedEvent(Id, FlightId, PNR));
    }

    public void Cancel()
    {
        Status = BookingStatus.Cancelled;
        AddDomainEvent(new BookingCancelledEvent(Id, FlightId, PNR));
    }

    private static string GeneratePNRCode()
    {
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        var result = new char[6];
        for (int i = 0; i < 6; i++)
        {
            result[i] = chars[random.Next(chars.Length)];
        }
        return new string(result);
    }
}`
      },
      {
        name: "Value Objects",
        path: "Domain/ValueObjects/Money.cs",
        language: "csharp",
        description: "Value objects ensuring money validations and standard numeric operators.",
        content: `namespace AirlineSystem.Domain.ValueObjects;

public record Money(decimal Amount, string Currency)
{
    public static Money Zero => new Money(0, "USD");

    public static Money FromUSD(decimal amount)
    {
        if (amount < 0) throw new ArgumentException("Amount cannot be negative");
        return new Money(amount, "USD");
    }

    public static Money operator +(Money left, Money right)
    {
        if (left.Currency != right.Currency)
            throw new InvalidOperationException("Currency mismatch");
            
        return new Money(left.Amount + right.Amount, left.Currency);
    }
}`
      }
    ]
  },
  {
    id: "phase3",
    title: "Phase 3: Microsoft Orleans Actors",
    subtitle: "Lock-Free Virtual Actor Grains for Flight Inventory & State",
    summary: "Orleans serves as the ultra-scale caching and consistency barrier. FlightGrains serialize reservation requests in-memory via actor green-threads, mathematically eliminating double bookings without heavy SQL record locks.",
    bestPractices: [
      "Avoid await calls to database inside Critical Path (Keep Grains dynamic & fully in-memory).",
      "Model Seat Inventory as a high-density BitArray or HashSet for instant O(1) checks.",
      "Write to persistence in a non-blocking throttled manner (Orleans State Storage)."
    ],
    tradeoffs: [
      "Requires grain rehydration on state loss, triggering small transient latency peaks.",
      "Orleans makes state retrieval extremely fast but requires strong state synchronization to persistence databases."
    ],
    scalability: "Silos form a lock-free distributed cluster. 100,000 distinct Flight instances scale linearly as grains are automatically balanced across all available servers.",
    failureScenarios: "If any Silo undergoes crash, the Orleans cluster immediately transfers the grain reference to an active Silo, rehydrating its latest snapshot from SQL/Redis.",
    files: [
      {
        name: "IFlightGrain Interface",
        path: "Orleans/Grains/IFlightGrain.cs",
        language: "csharp",
        description: "Standard grain interface declaring non-blocking distributed grain methods.",
        content: `using Orleans;

namespace AirlineSystem.Orleans.Grains;

public interface IFlightGrain : IGrainWithGuidKey
{
    Task<FlightStatusResponse> InitializeFlightAsync(int totalSeats, string aircraftType);
    Task<bool> ReserveSeatAsync(string seatNumber, Guid passengerId);
    Task<bool> ReleaseSeatAsync(string seatNumber);
    Task<int> GetAvailableSeatsCountAsync();
    Task<Dictionary<string, Guid>> GetOccupiedSeatsAsync();
}`
      },
      {
        name: "FlightGrain Active Actor",
        path: "Orleans/Grains/FlightGrain.cs",
        language: "csharp",
        description: "Virtual actor implementation enforcing concurrency-safe in-memory seat locks.",
        content: `using Orleans;
using Orleans.Providers;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AirlineSystem.Orleans.Grains;

[StorageProvider(ProviderName = "FlightStateStore")]
public class FlightGrain : Grain<FlightGrainState>, IFlightGrain
{
    private readonly ILogger<FlightGrain> _logger;

    public FlightGrain(ILogger<FlightGrain> logger)
    {
        _logger = logger;
    }

    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Activating Flight Actor Grain: {Id}", State.FlightId);
        await base.OnActivateAsync(cancellationToken);
    }

    public Task<FlightStatusResponse> InitializeFlightAsync(int totalSeats, string aircraftType)
    {
        State.FlightId = this.GetPrimaryKey();
        State.TotalSeats = totalSeats;
        State.AircraftType = aircraftType;
        State.ReservedSeats ??= new Dictionary<string, Guid>();
        State.IsInitialized = true;
        
        _logger.LogInformation("Flight Grain {Id} initialized with {Seats} seats.", State.FlightId, totalSeats);
        return Task.FromResult(new FlightStatusResponse(State.FlightId, State.TotalSeats, true));
    }

    public async Task<bool> ReserveSeatAsync(string seatNumber, Guid passengerId)
    {
        if (!State.IsInitialized)
            throw new InvalidOperationException("Flight is not initialized");

        // Single-threaded Orleans actor ensures mathematical safety here
        if (State.ReservedSeats.ContainsKey(seatNumber))
        {
            _logger.LogWarning("Seat Conflict: {Seat} on {Flight} is already taken", seatNumber, State.FlightId);
            return false; // Atomically fails!
        }

        if (State.ReservedSeats.Count >= State.TotalSeats)
        {
            _logger.LogWarning("Flight {Flight} is fully overbooked!", State.FlightId);
            return false;
        }

        State.ReservedSeats[seatNumber] = passengerId;
        
        // Push state snapshot to persistence non-blocking
        await WriteStateAsync();
        
        _logger.LogInformation("Seat {Seat} reserved successfully for passenger {PassengerId}", seatNumber, passengerId);
        return true;
    }

    public async Task<bool> ReleaseSeatAsync(string seatNumber)
    {
        if (State.ReservedSeats.Remove(seatNumber))
        {
            await WriteStateAsync();
            _logger.LogInformation("Seat {Seat} released successfully or cancelled.", seatNumber);
            return true;
        }
        return false;
    }

    public Task<int> GetAvailableSeatsCountAsync()
    {
        return Task.FromResult(State.TotalSeats - State.ReservedSeats.Count);
    }

    public Task<Dictionary<string, Guid>> GetOccupiedSeatsAsync()
    {
        return Task.FromResult(new Dictionary<string, Guid>(State.ReservedSeats));
    }
}

[Serializable]
public class FlightGrainState
{
    public Guid FlightId { get; set; }
    public string AircraftType { get; set; } = string.Empty;
    public int TotalSeats { get; set; }
    public bool IsInitialized { get; set; }
    public Dictionary<string, Guid> ReservedSeats { get; set; } = new();
}`
      }
    ]
  },
  {
    id: "phase4",
    title: "Phase 4: CQRS & MediatR",
    subtitle: "Slicing commands, validation PIPELINE, and optimized handlers",
    summary: "Segregates the Domain writes from optimized database reads. Uses MediatR Pipelines to validate request data fluently before invocation.",
    bestPractices: [
      "Implement automatic FluentValidation in MediatR Behavior pipelines, bypassing handlers if inputs are corrupted.",
      "Ensure queries bypass heavy DDD models, pulling pure dynamic models or raw JSON lists from SQL Server read replicas."
    ],
    tradeoffs: [
      "Splitting into separate commands, queries, and handlers increases the file count, but ensures total SOLID structure."
    ],
    scalability: "Command pipelines can trigger Orleans in-memory updates instantly, while queries run in direct Dapper streams safely.",
    failureScenarios: "Handler validation exceptions are caught globally by the API Gateway or middleware filters, outputting structured RFC-7807 JSON.",
    files: [
      {
        name: "Create Booking Command",
        path: "Application/Bookings/Commands/CreateBookingCommand.cs",
        language: "csharp",
        description: "MediatR Command record carrying payment info and passenger details.",
        content: `using MediatR;
using FluentValidation;

namespace AirlineSystem.Application.Bookings.Commands;

public record CreateBookingCommand(
    Guid FlightId,
    string SeatNumber,
    Guid PassengerId,
    decimal PriceAmount,
    string Currency
) : IRequest<BookingResponse>;

public class CreateBookingCommandValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingCommandValidator()
    {
        RuleFor(x => x.FlightId).NotEmpty().WithMessage("Flight ID is mandatory.");
        RuleFor(x => x.SeatNumber).NotEmpty().MaximumLength(4);
        RuleFor(x => x.PassengerId).NotEmpty();
        RuleFor(x => x.PriceAmount).GreaterThan(0).WithMessage("Price must be greater than zero.");
    }
}`
      },
      {
        name: "Command Handler",
        path: "Application/Bookings/Handlers/CreateBookingCommandHandler.cs",
        language: "csharp",
        description: "Executes MediatR logic, orchestrates Orleans actor, and persists state across EF aggregates.",
        content: `using MediatR;
using Orleans;
using AirlineSystem.Orleans.Grains;
using AirlineSystem.Domain.Aggregates;

namespace AirlineSystem.Application.Bookings.Handlers;

public class CreateBookingCommandHandler : IRequestHandler<CreateBookingCommand, BookingResponse>
{
    private readonly IGrainFactory _grainFactory;
    private readonly IBookingRepository _bookingRepository;
    private readonly ILogger<CreateBookingCommandHandler> _logger;

    public CreateBookingCommandHandler(
        IGrainFactory grainFactory,
        IBookingRepository bookingRepository,
        ILogger<CreateBookingCommandHandler> logger)
    {
        _grainFactory = grainFactory;
        _bookingRepository = bookingRepository;
        _logger = logger;
    }

    public async Task<BookingResponse> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        // 1. Invoke single-threaded Flight Orleans Grain for concurrency check
        var flightGrain = _grainFactory.GetGrain<IFlightGrain>(request.FlightId);
        
        _logger.LogInformation("Acquiring lock-free virtual lease on Seat {Seat}", request.SeatNumber);
        bool isReserved = await flightGrain.ReserveSeatAsync(request.SeatNumber, request.PassengerId);
        
        if (!isReserved)
        {
            throw new DoubleBookingException($"Seat {request.SeatNumber} is already occupied on flight {request.FlightId}.");
        }

        // 2. Persist Aggregate Booking State in Flight database with Saga status PENDING
        var isUSD = request.Currency == "USD";
        var price = Money.FromUSD(request.PriceAmount);
        
        var passengerList = new List<Passenger> { new Passenger(request.PassengerId) };
        var booking = Booking.Create(request.FlightId, passengerList, price);

        await _bookingRepository.SaveAsync(booking, cancellationToken);

        _logger.LogInformation("Booking PENDING state saved for PNR: {PNR}", booking.PNR);
        return new BookingResponse(booking.Id, booking.PNR, "Pending");
    }
}`
      }
    ]
  },
  {
    id: "phase5",
    title: "Phase 5: RabbitMQ Messaging Topology",
    subtitle: "High-Reliability Publishers, Idempotent Consumers and DLQ Setup",
    summary: "Asynchronous integration broker enabling total decoupling. Uses exchange routing topologies with Dead Letter Queues (DLQ) to retry on downstream transactional limits.",
    bestPractices: [
      "Use Topic Exchanges with routing patterns (*.booking.created, *.booking.failed).",
      "Store unique Message IDs inside database Inbox tables to guarantee idempotent processor loops."
    ],
    tradeoffs: [
      "RabbitMQ ensures extreme loose-coupling but yields eventual consistency, calling for asynchronous UI update alerts (WebSockets)."
    ],
    scalability: "RabbitMQ cluster manages millions of events safely utilizing backpressure policies and multi-channel connection multiplexing.",
    failureScenarios: "If Ticket service dies, the message lands on Dead Letter queues, waiting for redelivery with geometric exponential back-off.",
    files: [
      {
        name: "RabbitMQ Settings",
        path: "Infrastructure/Messaging/RabbitMqExtensions.cs",
        language: "csharp",
        description: "Registers connections, declares exchanges, routes, and dead-letter queue structures dynamically.",
        content: `using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;

namespace AirlineSystem.Infrastructure.Messaging;

public static class RabbitMqExtensions
{
    public static IServiceCollection AddRabbitMqMessaging(this IServiceCollection services, string hostName)
    {
        services.AddSingleton<IConnectionFactory>(sp => new ConnectionFactory
        {
            HostName = hostName,
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = true
        });

        services.AddSingleton<IMessagePublisher, RabbitMqMessagePublisher>();
        return services;
    }
}`
      },
      {
        name: "Idempotent Consumer",
        path: "Infrastructure/Messaging/BookingCreatedConsumer.cs",
        language: "csharp",
        description: "Protects logic from double-delivery using Inbox checking inside SQL transaction scopes.",
        content: `using System.Text.Json;
using System.Threading.Tasks;
using RabbitMQ.Client.Events;
using AirlineSystem.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace AirlineSystem.Infrastructure.Messaging;

public class BookingCreatedConsumer : AsyncEventingBasicConsumer
{
    private readonly DbContext _dbContext;
    private readonly ILogger<BookingCreatedConsumer> _logger;

    public BookingCreatedConsumer(
        IModel model, 
        DbContext dbContext,
        ILogger<BookingCreatedConsumer> logger) : base(model)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task HandleMessageAsync(BasicDeliverEventArgs ea)
    {
        var messageId = ea.BasicProperties.MessageId;
        var body = System.Text.Encoding.UTF8.GetString(ea.Body.ToArray());
        var rawEvent = JsonSerializer.Deserialize<BookingCreatedEvent>(body);

        using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            // Inbox Pattern check for absolute idempotency safety
            var alreadyProcessed = await _dbContext.Set<ProcessedMessage>()
                .AnyAsync(m => m.MessageId == messageId);

            if (alreadyProcessed)
            {
                _logger.LogWarning("Inbox Check: Message {Id} already processed, skipping...", messageId);
                await transaction.CommitAsync();
                return;
            }

            // Perform core integration logic: Notify Ticket Service
            _logger.LogInformation("Processing booking creation for ID: {Id}", rawEvent!.BookingId);

            _dbContext.Set<ProcessedMessage>().Add(new ProcessedMessage
            {
                MessageId = messageId,
                ProcessedAt = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transaction failed. Shifting message to DLQ.");
            await transaction.RollbackAsync();
            throw; // Rejects message, automatic routing transfers it to Dead-Letter properties
        }
    }
}`
      }
    ]
  },
  {
    id: "phase6",
    title: "Phase 6: Distributed Booking Saga",
    subtitle: "Orchestration State Machine vs Choreography Compensations",
    summary: "Orchestrates multi-service steps safely. Implements an explicit Saga Orchestrator to monitor, dispatch, rollback, and coordinate booking events visually.",
    bestPractices: [
      "Keep Saga Orchestration transparent: record complete history logs inside a single system database.",
      "Write atomic, immutable compensating actions: 'ReleaseSeat' action must contain the exact reference reserved during state."
    ],
    tradeoffs: [
      "Saga Orchestration adds a central point of failure requiring high-availability hosting, whereas Choreography is easy to start but extremely complex to debug."
    ],
    scalability: "Saga workflows are asynchronous and non-blocking, scaling effectively even during network latency or high passenger queues.",
    failureScenarios: "If 'Issue Ticket' fails, the Booking Saga instantly executes compensating steps, calling FlightGrain to release seats and flagging Booking as Cancelled.",
    files: [
      {
        name: "Saga Orchestrator",
        path: "Sagas/BookingSagaOrchestrator.cs",
        language: "csharp",
        description: "State machine managing steps: Check -> Reserve -> Save aggregate -> Ticket -> Done.",
        content: `using System;
using System.Threading.Tasks;

namespace AirlineSystem.Sagas;

public class BookingSagaOrchestrator
{
    private readonly IGrainFactory _grainFactory;
    private readonly IMessagePublisher _publisher;
    private readonly IBookingRepository _bookingDb;
    private readonly ILogger<BookingSagaOrchestrator> _logger;

    public BookingSagaOrchestrator(
        IGrainFactory grainFactory,
        IMessagePublisher publisher,
        IBookingRepository bookingDb,
        ILogger<BookingSagaOrchestrator> logger)
    {
        _grainFactory = grainFactory;
        _publisher = publisher;
        _bookingDb = bookingDb;
        _logger = logger;
    }

    public async Task ExecuteSagaAsync(SagaContext context)
    {
        _logger.LogInformation("Starting distributed Booking Saga ID: {Id}", context.SagaId);
        
        try
        {
            // Step 1: Reserve Orleans Seat
            var flightGrain = _grainFactory.GetGrain<IFlightGrain>(context.FlightId);
            bool isSeatLocked = await flightGrain.ReserveSeatAsync(context.SeatNumber, context.PassengerId);
            
            if (!isSeatLocked)
            {
                _logger.LogWarning("Saga failed at Seat Lock, compensation not needed.");
                throw new SagaException("Seat is occupied.");
            }
            context.StepCompleted(SagaStep.ReserveSeat);

            // Step 2: Book aggregate inside database
            var booking = Booking.Create(context.FlightId, context.PassengerId, context.Price);
            await _bookingDb.SaveAsync(booking);
            context.StepCompleted(SagaStep.CreateBooking);

            // Step 3: Trigger Ticket creation event over RabbitMQ
            await _publisher.PublishEventAsync(new TicketRequestedEvent(booking.Id, context.PassengerId));
            _logger.LogInformation("Booking Saga waiting on Ticket Event completion...");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Saga compilation failed. Executing compensation chain...");
            await RollbackSagaAsync(context);
        }
    }

    public async Task RollbackSagaAsync(SagaContext context)
    {
        _logger.LogWarning("Compensating Saga ID: {Id} on steps...", context.SagaId);

        if (context.IsStepCompleted(SagaStep.ReserveSeat))
        {
            var flightGrain = _grainFactory.GetGrain<IFlightGrain>(context.FlightId);
            await flightGrain.ReleaseSeatAsync(context.SeatNumber);
            _logger.LogWarning("Compensation: Seat {Seat} released", context.SeatNumber);
        }

        if (context.IsStepCompleted(SagaStep.CreateBooking))
        {
            var booking = await _bookingDb.GetByIdAsync(context.BookingId);
            if (booking != null)
            {
                booking.Cancel();
                await _bookingDb.UpdateAsync(booking);
                _logger.LogWarning("Compensation: PNR Booking status marked as CANCELLED");
            }
        }
    }
}

public enum SagaStep
{
    ReserveSeat,
    CreateBooking,
    IssueTicket
}`
      }
    ]
  },
  {
    id: "phase7",
    title: "Phase 7: Persistence Strategy",
    subtitle: "EF Core Transactional Outbox & Database Interceptors",
    summary: "Guarantees reliable message transfer even under compute crashes. Saves aggregate state and outward events in the same transaction using EF Core Interceptors, ensuring 100% atomicity.",
    bestPractices: [
      "Use relational storage for transactional records (MSSQL/PostgreSQL).",
      "Process Outbox tables inside a highly efficient continuous background daemon (Worker)."
    ],
    tradeoffs: [
      "Adds a small storage read/write penalty on each business mutation, but avoids critical message drop anomalies entirely."
    ],
    scalability: "Database index models allow high-speed CRUD execution. Partitioning database tables by FlightDate or PNR ranges speeds up querying.",
    failureScenarios: "If the RabbitMQ broker drops, events remain logged safely in SQL Server Outbox tables, awaiting connection recovery.",
    files: [
      {
        name: "Outbox Table Schema & Model",
        path: "Persistence/Outbox/OutboxMessage.cs",
        language: "csharp",
        description: "Represents an unsent integration event stored inside the relational database.",
        content: `using System;

namespace AirlineSystem.Persistence.Outbox;

public class OutboxMessage
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime OccurredOnUtc { get; set; }
    public DateTime? ProcessedOnUtc { get; set; }
    public string? Error { get; set; }
}`
      },
      {
        name: "Outbox Background Publisher",
        path: "Persistence/Outbox/OutboxPublisherBackgroundJob.cs",
        language: "csharp",
        description: "High-frequency background HostedService pulling, delivering, and marking outbox events safely.",
        content: `using Microsoft.Extensions.Hosting;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;

namespace AirlineSystem.Persistence.Outbox;

public class OutboxPublishingBackgroundJob : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IMessagePublisher _publisher;
    private readonly ILogger<OutboxPublishingBackgroundJob> _logger;

    public OutboxPublishingBackgroundJob(
        IServiceProvider serviceProvider,
        IMessagePublisher publisher,
        ILogger<OutboxPublishingBackgroundJob> logger)
    {
        _serviceProvider = serviceProvider;
        _publisher = publisher;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Outbox Publisher worker process started successfully.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();

                var messages = await dbContext.Set<OutboxMessage>()
                    .Where(m => m.ProcessedOnUtc == null)
                    .OrderBy(m => m.OccurredOnUtc)
                    .Take(50)
                    .ToListAsync(stoppingToken);

                foreach (var message in messages)
                {
                    try
                    {
                        // Safely dispatch to RabbitMQ broker
                        await _publisher.PublishRawStringAsync(message.Type, message.Content);
                        
                        message.ProcessedOnUtc = DateTime.UtcNow;
                    }
                    catch (Exception publishEx)
                    {
                        _logger.LogError(publishEx, "Unable to publish Event ID: {Id}", message.Id);
                        message.Error = publishEx.Message;
                    }
                }

                if (messages.Count > 0)
                {
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Critical error inside Outbox Processing Loop.");
            }

            await Task.Delay(500, stoppingToken); // Check for mutations every 500ms
        }
    }
}`
      }
    ]
  },
  {
    id: "phase8",
    title: "Phase 8: High Speed Redis Cache",
    subtitle: "Pre-fetching cached searches and rate limits",
    summary: "Integrates Redis caching to prevent database heavy checks. Solves flight search requests under 200ms using key structure models with strategic TTLs.",
    bestPractices: [
      "Use specific cache key syntax model structure: 'flight-search:{origin}:{destination}:{date}'.",
      "Stagger TTLs with dynamic fuzz jitter to prevent global cache stampede blockages."
    ],
    tradeoffs: [
      "Speed is exceptional (<50ms) but relies on direct automatic cache invalidation models immediately when booking counts modify."
    ],
    scalability: "Redis clustered instances scale memory limits easily, serving read-dominated flight traffic on high-demand holidays.",
    failureScenarios: "If Redis dies, cache operations are wrapped in Polly try-catch bypass structures, routing requests to master databases safely.",
    files: [
      {
        name: "Flight Search Cache Service",
        path: "Infrastructure/Caching/RedisFlightCache.cs",
        language: "csharp",
        description: "Saves and extracts parsed flight availability lists with adaptive TTL strategies.",
        content: `using StackExchange.Redis;
using System.Text.Json;

namespace AirlineSystem.Infrastructure.Caching;

public class RedisFlightCache : IFlightCache
{
    private readonly IDatabase _database;
    private readonly ILogger<RedisFlightCache> _logger;

    public RedisFlightCache(IConnectionMultiplexer redis, ILogger<RedisFlightCache> logger)
    {
        _database = redis.GetDatabase();
        _logger = logger;
    }

    public async Task<List<FlightDto>?> GetAvailableFlightsAsync(string from, string to, string date)
    {
        var key = $"flight-search:{from}:{to}:{date}";
        
        try
        {
            var value = await _database.StringGetAsync(key);
            if (value.HasValue)
            {
                _logger.LogInformation("Redis High-Speed Cache HIT for path: {Key}", key);
                return JsonSerializer.Deserialize<List<FlightDto>>(value!);
            }
        }
        catch (RedisException ex)
        {
            _logger.LogError(ex, "Bypassing failing Redis cache. Accessing underlying database directly.");
        }

        return null; // Hits Database and triggers automatic recovery re-saving
    }

    public async Task SetAvailableFlightsAsync(string from, string to, string date, List<FlightDto> flights)
    {
        var key = $"flight-search:{from}:{to}:{date}";
        var payload = JsonSerializer.Serialize(flights);
        
        // Define TTL Strategy - e.g., 5-minute search window with 30s jitter
        var randomJitter = TimeSpan.FromSeconds(new Random().Next(0, 30));
        var ttl = TimeSpan.FromMinutes(5) + randomJitter;

        try
        {
            await _database.StringSetAsync(key, payload, ttl);
            _logger.LogInformation("Redis search saved. TTL set to {TTL}", ttl);
        }
        catch (RedisException)
        {
            // Bypasses logging failure silently
        }
    }
}`
      }
    ]
  },
  {
    id: "phase9",
    title: "Phase 9: Distributed Observability",
    subtitle: "W3C Tracing, OpenTelemetry & Logging setups",
    summary: "Integrates unified metrics, high-throughput tracing, and correlation log ids. Visualizes transaction paths from Gateways to Orleans down to DB transactions.",
    bestPractices: [
      "Propagate 'traceparent' header context tags across all RabbitMQ envelopes.",
      "Track system metrics (total reservations, success ratios) inside continuous prometheus scrapers."
    ],
    tradeoffs: [
      "Sampling must be limited in production (e.g. 10%) to minimize CPU and networking trace overheads."
    ],
    scalability: "Independent OpenTelemetry Collector nodes assemble dynamic payloads, sending formatted datasets cleanly to Jaeger or Grafana clusters.",
    failureScenarios: "If Jaeger server lags, Otel memory ring buffer dumps old traces selectively to optimize local process RAM boundaries.",
    files: [
      {
        name: "Observability Registrations",
        path: "Infrastructure/Observability/DiagnosticRegistration.cs",
        language: "csharp",
        description: "Registers OpenTelemetry tracing, meters, Serilog console sinks, and diagnostic metrics.",
        content: `using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

namespace AirlineSystem.Infrastructure.Observability;

public static class DiagnosticRegistration
{
    public static void ConfigureObservability(this WebApplicationBuilder builder, string serviceName)
    {
        // Custom Serilog console tracer
        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {NewLine}{Exception}")
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Service", serviceName)
            .CreateLogger();

        builder.Host.UseSerilog();

        // Register OpenTelemetry Tracing
        builder.Services.AddOpenTelemetry()
            .WithResources(res => res.AddService(serviceName))
            .WithTracing(tracing => tracing
                .AddSource("AirlineSystem.*")
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddEntityFrameworkCoreInstrumentation()
                .AddJaegerExporter(opt =>
                {
                    opt.AgentHost = "jaeger-collector";
                    opt.AgentPort = 6831;
                }))
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddRuntimeInstrumentation()
                .AddMeter("AirlineSystem.BookingService.Meter")
                .AddPrometheusExporter());
    }
}`
      }
    ]
  },
  {
    id: "phase10",
    title: "Phase 10: Docker & Kubernetes Infrastructure",
    subtitle: "Production deployment patterns & Orleans Clustering Yaml manifests",
    summary: "Complete cloud-native deployment config. Configures Kubernetes scaling plans, ingress layers, secrets database, and stateful Orleans Clustering setups.",
    bestPractices: [
      "Use lightweight Alpine SDK base layers to shrink Docker image weights below 220MB.",
      "Leverage Orleans ADO.NET SQL Clustering parameters for reliable dynamic dynamic silo discovery."
    ],
    tradeoffs: [
      "Orleans Stateful Pods need specific dynamic IP setups to communicate directly, shifting config requirements from standard simple deployments."
    ],
    scalability: "Horizontal scale configurations (HPA) scale the services automatically, utilizing CPU and passenger-load metrics reliably.",
    failureScenarios: "If an active Pod drops unexpectedly, K8s reboots containers in <5 seconds while the Orleans cluster heals itself automatically without passenger disruptions.",
    files: [
      {
        name: "Docker Compose Settings",
        path: "Infrastructure/Docker/docker-compose.yml",
        language: "yaml",
        description: "Builds Gateway, services, SQL databases, RabbitMQ queues, and Redis cache clusters.",
        content: `version: '3.8'

services:
  gateway:
    image: airline-gateway:latest
    build:
      context: .
      dockerfile: Gateway/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
    depends_on:
      - flights
      - bookings

  flights:
    image: flight-service:latest
    environment:
      - ConnectionStrings__DefaultConnection=Server=sqlserver;Database=FlightsDb;User Id=sa;Password=SecurePassword123!;TrustServerCertificate=True
      - Orleans__Clustering=SQLServer
    depends_on:
      - sqlserver
      - redis

  redis:
    image: redis:7.0-alpine
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3.11-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    ports:
      - "1433:1433"
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=SecurePassword123!`
      },
      {
        name: "Kubernetes K8s Deployment",
        path: "Infrastructure/Kubernetes/deployment.yaml",
        language: "yaml",
        description: "Declares scaling boundaries, pod allocations, secrets, and Orleans clustering node discoverability parameters.",
        content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: booking-service
  namespace: airline-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: booking-service
  template:
    metadata:
      labels:
        app: booking-service
    spec:
      containers:
      - name: booking-service
        image: airline-registry.azurecr.io/booking-service:v1.0
        ports:
        - containerPort: 5010
        - containerPort: 11111 # Orleans cluster communication port
        - containerPort: 30000 # Orleans Gateway port
        env:
        - name: ConnectionStrings__DefaultConnection
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: connectionString
        resources:
          limits:
            cpu: "1"
            memory: 1Gi
          requests:
            cpu: "250m"
            memory: 512Mi
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 5010
          initialDelaySeconds: 15
          periodSeconds: 10
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: booking-hpa
  namespace: airline-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: booking-service
  minReplicas: 3
  maxReplicas: 15
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75`
      }
    ]
  }
];
