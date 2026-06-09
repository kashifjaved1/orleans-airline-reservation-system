using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace OrionAirline.Persistence;

public class DbInboxMessage
{
    [Key]
    public Guid Id { get; set; }

    [Required, MaxLength(100)]
    public string MessageId { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string EventType { get; set; } = string.Empty;

    public string EventPayload { get; set; } = string.Empty;

    public DateTime ReceivedOnUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ProcessedOnUtc { get; set; }

    [MaxLength(500)]
    public string? ErrorMessage { get; set; }
}
