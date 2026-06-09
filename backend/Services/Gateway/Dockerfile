FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY Services/Gateway/OrionAirline.Gateway.csproj Services/Gateway/
RUN dotnet restore Services/Gateway/OrionAirline.Gateway.csproj
COPY . .
WORKDIR /src/Services/Gateway
RUN dotnet build OrionAirline.Gateway.csproj -c Release -o /app/build

FROM build AS publish
RUN dotnet publish OrionAirline.Gateway.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "OrionAirline.Gateway.dll"]
