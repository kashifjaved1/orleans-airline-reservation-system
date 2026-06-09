FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 11111
EXPOSE 30000

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY OrionAirline.sln .
COPY OrionAirline.Api/OrionAirline.Api.csproj OrionAirline.Api/
COPY OrionAirline.Grains/OrionAirline.Grains.csproj OrionAirline.Grains/
COPY OrionAirline.Core/OrionAirline.Core.csproj OrionAirline.Core/
COPY OrionAirline.Persistence/OrionAirline.Persistence.csproj OrionAirline.Persistence/
COPY OrionAirline.Sagas/OrionAirline.Sagas.csproj OrionAirline.Sagas/
RUN dotnet restore OrionAirline.Api/OrionAirline.Api.csproj
COPY . .
WORKDIR /src/OrionAirline.Api
RUN dotnet build OrionAirline.Api.csproj -c Release -o /app/build

FROM build AS publish
RUN dotnet publish OrionAirline.Api.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "OrionAirline.Api.dll"]
