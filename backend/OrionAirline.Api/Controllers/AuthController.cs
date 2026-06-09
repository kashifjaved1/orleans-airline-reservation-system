using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace OrionAirline.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public AuthController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        if (request.Username != "admin" && request.Username != "agent" && request.Username != "customer")
            return Unauthorized(new { message = "Invalid credentials" });

        var role = request.Username switch
        {
            "admin" => "Admin",
            "agent" => "Agent",
            _ => "Customer"
        };

        var token = GenerateJwtToken(request.Username, role);
        var refreshToken = GenerateRefreshToken();

        return Ok(new AuthResponse(
            AccessToken: token,
            RefreshToken: refreshToken,
            ExpiresIn: _configuration.GetValue<int>("JwtSettings:AccessTokenExpirationMinutes", 15) * 60,
            Role: role
        ));
    }

    [HttpPost("refresh")]
    public IActionResult Refresh([FromBody] RefreshRequest request)
    {
        var handler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecretKey"]!);

        try
        {
            var principal = handler.ValidateToken(request.AccessToken, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = false,
                ValidIssuer = _configuration["JwtSettings:Issuer"],
                ValidAudience = _configuration["JwtSettings:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(key)
            }, out _);

            var newToken = GenerateJwtToken(
                principal.Identity!.Name!,
                principal.FindFirst(ClaimTypes.Role)!.Value
            );

            return Ok(new AuthResponse(newToken, "", 900, principal.FindFirst(ClaimTypes.Role)!.Value));
        }
        catch
        {
            return Unauthorized(new { message = "Invalid token" });
        }
    }

    private string GenerateJwtToken(string username, string role)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecretKey"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddMinutes(
            _configuration.GetValue<int>("JwtSettings:AccessTokenExpirationMinutes", 15));

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
            new Claim("scope", "api")
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["JwtSettings:Issuer"],
            audience: _configuration["JwtSettings:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
}

public record LoginRequest(string Username, string Password);
public record RefreshRequest(string AccessToken, string RefreshToken);
public record AuthResponse(string AccessToken, string RefreshToken, int ExpiresIn, string Role);
