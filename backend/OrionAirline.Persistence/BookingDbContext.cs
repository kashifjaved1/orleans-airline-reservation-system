using Microsoft.EntityFrameworkCore;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrionAirline.Persistence;

public class BookingDbContext : DbContext
{
    public BookingDbContext(DbContextOptions<BookingDbContext> options) : base(options)
    {
    }

    public DbSet<DbBooking> Bookings => Set<DbBooking>();
    public DbSet<DbOutboxMessage> OutboxMessages => Set<DbOutboxMessage>();
    public DbSet<DbInboxMessage> InboxMessages => Set<DbInboxMessage>();
    public DbSet<DbSagaLog> SagaLogs => Set<DbSagaLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DbBooking>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.PNR).IsRequired().HasMaxLength(6);
            entity.HasIndex(e => e.PNR).IsUnique();
            entity.Property(e => e.SeatNumber).IsRequired().HasMaxLength(4);
            entity.Property(e => e.UserId).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(20);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.FlightId).HasMaxLength(50);
            entity.HasIndex(e => e.FlightId);
        });

        modelBuilder.Entity<DbOutboxMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EventType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EventPayload).IsRequired();
            entity.HasIndex(e => new { e.ProcessedOnUtc, e.OccurredOnUtc });
        });

        modelBuilder.Entity<DbInboxMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.MessageId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EventType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EventPayload).IsRequired();
            entity.HasIndex(e => e.MessageId).IsUnique();
            entity.HasIndex(e => new { e.ProcessedOnUtc, e.ReceivedOnUtc });
        });

        modelBuilder.Entity<DbSagaLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SagaId).IsRequired().HasMaxLength(50);
            entity.Property(e => e.StepName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(20);
            entity.HasIndex(e => e.SagaId);
        });
    }
}

public class DbBooking
{
    public Guid Id { get; set; }
    public string PNR { get; set; } = string.Empty;
    public string SeatNumber { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string? FlightId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class DbOutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EventPayload { get; set; } = string.Empty;
    public DateTime OccurredOnUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedOnUtc { get; set; }
    public int RetryCount { get; set; }
    public string? ErrorMessage { get; set; }
}

public class DbSagaLog
{
    public Guid Id { get; set; }
    public string SagaId { get; set; } = string.Empty;
    public string StepName { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
