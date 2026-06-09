# ✈️ Orion Airline Reservation System

A **production-grade, distributed airline reservation system** built with .NET 9 + Microsoft Orleans. 
Designed to teach modern distributed systems patterns to .NET developers.

---

## 🚀 Quick Start

### Prerequisites
```powershell
dotnet --version   # 9.x
node --version     # 18.x+
docker --version   # Any recent version
```

### 1. Start Infrastructure (Docker)
```powershell
cd backend
docker compose up -d sqlserver redis rabbitmq
# Wait 30s for SQL Server to boot
```

### 2. Start the Backend API
```powershell
# Terminal 1 — starts on http://localhost:5000
dotnet run --project OrionAirline.Api
```

### 3. Start the Frontend
```powershell
# Terminal 2 — starts on http://localhost:3000
npm install
npm run dev
```

### 4. Use the App

Open **http://localhost:3000** in your browser.

**Flow:**
1. Click **"Init flight"** (bottom of Flight panel) to create 102 seats
2. Click **"New Passenger"** → fill in name/passport → **Save**
3. Select a **green seat** on the cabin map
4. Click **"Confirm & Issue Ticket"**
5. Watch the audit trail stream live saga steps
6. **Cancel** a booking from the Boarding Passes section

---

## 🧱 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite) — http://localhost:3000             │
│  PassengerTerminal.tsx — calls backend API directly          │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP (fetch)
┌──────────────────────────▼───────────────────────────────────┐
│  ASP.NET Core Web API — http://localhost:5000                │
│                                                              │
│  ├─ Controllers (Auth, Bookings, Flights, Passengers, Tickets)│
│  ├─ MediatR (CQRS Commands + Queries)                       │
│  ├─ FluentValidation (input validation pipeline)            │
│  ├─ JWT Auth (Bearer tokens, role-based)                    │
│  ├─ Serilog (structured logging)                            │
│  ├─ OpenTelemetry (distributed tracing)                     │
│  └─ Health Checks (SQL, Redis, RabbitMQ)                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Orleans Silo (localhost clustering)                    │  │
│  │  ├─ FlightGrain   — seat inventory + concurrency lock  │  │
│  │  ├─ BookingGrain  — state machine (Pending→Confirmed)  │  │
│  │  ├─ PassengerGrain — profile + loyalty points          │  │
│  │  └─ TicketGrain   — ticket lifecycle                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  MassTransit + RabbitMQ                                │  │
│  │  ├─ OutboxPublishingJob  → polls DB → publishes events │  │
│  │  └─ BookingCreatedConsumer → Inbox pattern processing  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  EF Core + SQL Server                                  │  │
│  │  ├─ Bookings, OutboxMessages, InboxMessages, SagaLogs │  │
│  │  └─ Transactional Outbox (atomic DB + event save)     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Redis (StackExchange.Redis)                            │  │
│  │  ├─ Flight search cache     TTL: 5 min                 │  │
│  │  ├─ Booking cache           TTL: 10 min                │  │
│  │  └─ Rate limiting           INCR + EXPIRE              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
backend/                          # .NET 9 solution (6 projects)
├── OrionAirline.sln
├── docker-compose.yml            # SQL Server + Redis + RabbitMQ
├── OrionAirline.Api/             # Host: controllers, middleware, DI
│   ├── Program.cs                # Everything wired up here
│   ├── Controllers/
│   │   ├── AuthController.cs     # POST /api/auth/login
│   │   ├── FlightsController.cs  # GET /api/flights, init, seats
│   │   ├── BookingsController.cs # POST /api/bookings, cancel, get
│   │   ├── PassengersController.cs
│   │   └── TicketsController.cs
│   └── appsettings.json
├── OrionAirline.Grains/          # Orleans virtual actors
│   ├── FlightGrain.cs            # Seat map, concurrency, state
│   ├── BookingGrain.cs           # Booking state machine
│   ├── PassengerGrain.cs         # Profile + loyalty
│   └── TicketGrain.cs            # Ticket lifecycle
├── OrionAirline.Core/            # CQRS layer
│   └── CQRS/
│       ├── Commands.cs           # CreateBookingCommand, etc.
│       ├── Queries.cs            # GetFlightQuery, etc.
│       ├── Handlers.cs           # Command + Query handlers
│       ├── Validators.cs         # FluentValidation rules
│       └── PipelineBehaviors.cs  # Logging + Validation pipeline
├── OrionAirline.Persistence/     # EF Core, Outbox, Inbox, Redis
│   ├── BookingDbContext.cs       # 4 tables + entity config
│   ├── OutboxPublishingJob.cs    # Background: DB → RabbitMQ
│   ├── BookingCreatedConsumer.cs # MassTransit consumer (Inbox)
│   ├── InboxPattern.cs           # DbInboxMessage entity
│   └── RedisCacheService.cs      # Cache + distributed locks
├── OrionAirline.Sagas/           # Saga orchestrator
│   └── BookingSagaOrchestrator.cs
└── Services/Gateway/             # YARP API Gateway (optional)

src/                              # React + Vite frontend
├── App.tsx                       # Main app shell (3 tabs)
├── main.tsx
├── index.css                     # Tailwind + custom styles
├── components/
│   ├── PassengerTerminal.tsx     # Main booking UI (calls real API)
│   ├── ArchitectureMap.tsx       # System topology visualization
│   └── SimulationEngine.tsx      # Load test simulator
├── types.ts
├── package.json
└── vite.config.ts
```

---

## 🔗 Frontend ↔ Backend API Endpoints

The frontend (`PassengerTerminal.tsx`) calls these endpoints on `http://localhost:5000`.
Both versioned (`/api/v1/...`) and unversioned (`/api/...`) routes are supported.

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/auth/login` or `/api/v1/auth/login` | Get JWT token | Public |
| GET | `/api/flights` or `/api/v1/flights` | List all flights | Public |
| GET | `/api/flights/{id}/seats` or `/api/v1/...` | Get seat map | Bearer |
| POST | `/api/flights/{id}/initialize?totalSeats=102` | Create seats | Admin |
| POST | `/api/bookings` or `/api/v1/bookings` | Create booking | Customer+ |
| GET | `/api/bookings/{id}` or `/api/v1/bookings/{id}` | Get booking details | Customer+ |
| POST | `/api/bookings/{id}/cancel` or `/api/v1/...` | Cancel booking + release seat | Customer+ |
| POST | `/api/passengers` or `/api/v1/passengers` | Register passenger | Public |
| GET | `/api/passengers/{id}` or `/api/v1/passengers/{id}` | Get passenger profile | Bearer |

---

## 🧠 Key Pattern: Orleans Concurrency

When 1000 users book the same seat at once:

```
UserA → POST /api/bookings  ─┐
UserB → POST /api/bookings  ─┤
UserC → POST /api/bookings  ─┤  FlightGrain("OR101") 
UserD → POST /api/bookings  ─┤  single-threaded queue
...                          ─┘  ┌──────────────────┐
                                 │ 1. UserA: check  │
                                 │    1A=available  │
                                 │    → reserve ✓   │
                                 │ 2. UserB: check  │
                                 │    1A=reserved   │
                                 │    → reject ✗   │
                                 │ 3. UserC: ...    │
                                 └──────────────────┘
```

Orleans guarantees **single-threaded execution per grain identity**. No locks. No race conditions. No double-booking.

---

## 🎯 How a Booking Flows End-to-End

```
Frontend              Backend API           Orleans               RabbitMQ            DB
   │                      │                    │                      │                 │
   │  POST /api/bookings  │                    │                      │                 │
   │─────────────────────►│                    │                      │                 │
   │                      │  Saga.Execute()    │                      │                 │
   │                      │────────────────────►                      │                 │
   │                      │                    │                      │                 │
   │                      │  BookingGrain()    │                      │                 │
   │                      │────────────────────►                      │                 │
   │                      │  CreateBookingAsync│                      │                 │
   │                      │◄───────────────────│                      │                 │
   │                      │                    │                      │                 │
   │                      │  FlightGrain()     │                      │                 │
   │                      │────────────────────►                      │                 │
   │                      │  BookSeatAsync(1A) │  ← single thread!    │                 │
   │                      │◄───────────────────│  seat now RESERVED   │                 │
   │                      │                    │                      │                 │
   │                      │  ConfirmBooking()  │                      │                 │
   │                      │────────────────────►                      │                 │
   │                      │◄───────────────────│                      │                 │
   │                      │                    │                      │                 │
   │                      │  IssueTicket()     │                      │                 │
   │                      │────────────────────►                      │                 │
   │                      │◄───────────────────│                      │                 │
   │                      │                    │                      │                 │
   │                      │  SaveChanges()     │                      │                 │
   │                      │──────────────────────────────────────────────────────────► │
   │                      │                    │                      │                 │
   │  ✓ { bookingId, pnr} │                    │                      │                 │
   │◄─────────────────────│                    │                      │                 │
   │                      │                    │                      │                 │
   │                      │                    │  OutboxPublishingJob │                 │
   │                      │                    │  polls every 1s      │                 │
   │                      │                    │──────────────────────►                 │
   │                      │                    │                      │  publish event  │
   │                      │                    │                      │────────────────►│
   │                      │                    │  BookingCreatedConsumer               │
   │                      │                    │◄─────────────────────│                 │
   │                      │                    │  (Inbox check)       │                 │
```

---

## 🐳 Docker Commands

```powershell
# Start all infrastructure
docker compose up -d sqlserver redis rabbitmq

# View logs
docker compose logs -f sqlserver

# Stop everything (keeps data)
docker compose down

# Stop + delete volumes (clean slate)
docker compose down -v

# Run API with all infra
docker compose up -d
```

---

## 🛠 Development Tips

**Reset everything:**
```powershell
docker compose down -v
docker compose up -d sqlserver redis rabbitmq
dotnet run --project backend/OrionAirline.Api
```

**See what's in Redis:**
```powershell
docker exec -it orion-redis redis-cli
> KEYS *
> GET flight:OR101
```

**Check RabbitMQ queues:**
```powershell
Open http://localhost:15672 (guest/guest)
→ Queues tab → see booking-created-queue
```

**Check Orleans dashboard:**
```powershell
Open http://localhost:8080
→ Active grains, request rates, memory
```

**Test API with curl:**
```powershell
$token = curl -X POST "http://localhost:5000/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}' | ConvertFrom-Json | Select -ExpandProperty accessToken

curl -X POST "http://localhost:5000/api/flights/OR101/initialize?totalSeats=102" -H "Authorization: Bearer $token"

curl -X POST "http://localhost:5000/api/bookings" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d '{"flightId":"OR101","passengerIds":["user1"],"seatNumber":"1A"}'
```

---

## 🧪 Integration Test Plan

To validate the full booking flow end-to-end:

### 1. Start Infrastructure
```powershell
cd backend
docker compose up -d sqlserver redis rabbitmq
```

### 2. Start API
```powershell
dotnet run --project OrionAirline.Api
```

### 3. Manual Test Flow (or use curl)
```powershell
# 3a. Login + get token
$token = curl -X POST "http://localhost:5000/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin"}' | ConvertFrom-Json | Select -ExpandProperty accessToken

# 3b. Initialize flight (creates 102 seats in Orleans)
curl -X POST "http://localhost:5000/api/flights/OR101/initialize?totalSeats=102" `
  -H "Authorization: Bearer $token"

# 3c. Register a passenger
$passenger = curl -X POST "http://localhost:5000/api/passengers" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"name":"Test User","passportNumber":"AB123456","contactInformation":"test@email.com"}' | ConvertFrom-Json

# 3d. Book a seat (triggers saga)
curl -X POST "http://localhost:5000/api/bookings" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d "{`"flightId`":`"OR101`",`"passengerIds`":[`"$($passenger.passengerId)`"],`"seatNumber`":`"1A`"}"

# 3e. Cancel booking (triggers compensation)
curl -X POST "http://localhost:5000/api/bookings/<bookingId>/cancel" `
  -H "Authorization: Bearer $token"
```

### 4. Verify Outcomes
- **Orleans Dashboard**: Open http://localhost:8080 → active grains, seat state
- **RabbitMQ**: Open http://localhost:15672 (guest/guest) → `booking-created-queue` messages
- **Redis**: `docker exec orion-redis redis-cli KEYS '*'` → cached searches/bookings
- **Swagger**: Open http://localhost:5000/swagger → try endpoints interactively

---

## 📚 Patterns Learned

| Pattern | File | What It Does |
|---------|------|-------------|
| **Actor Model** | `FlightGrain.cs` | Single-threaded per grain = no race conditions |
| **CQRS** | `Commands.cs`, `Handlers.cs` | Separate read/write models |
| **Saga** | `BookingSagaOrchestrator.cs` | Distributed transaction with compensation |
| **Outbox** | `OutboxPublishingJob.cs` | Atomic DB + event publishing |
| **Inbox** | `BookingCreatedConsumer.cs` | Idempotent message consumption |
| **Circuit Breaker** | `Program.cs` | Stop hammering a dead service |
| **Retry** | `Program.cs` | Exponential backoff for transient failures |
| **Pipeline** | `PipelineBehaviors.cs` | MediatR wraps every handler with logging + validation |
| **API Versioning** | `Program.cs` + controllers | Versioned routes via `[ApiVersion("1.0")]` |
| **Distributed Lock** | `RedisCacheService.cs` | `LockTakeAsync` for cross-instance seat contention |
| **Rate Limiting** | `RedisCacheService.cs` | `INCR+EXPIRE` atomic rate counter |
