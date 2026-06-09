import React, { useState, useRef, useEffect } from "react";
import {
  User, Plane, Ticket, Plus, Compass, Clock, Send, ShieldCheck,
  Trash2, Search, ArrowRight, Layers, Database, Cpu, Radio, ClipboardCheck, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const API = "http://localhost:5000";

interface Passenger {
  id: string;
  name: string;
  passportNumber: string;
  email: string;
  loyaltyPoints: number;
}

interface FlightInfo {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  time: string;
  aircraft: string;
  totalSeats: number;
  availableSeats: number;
}

interface SeatStatus {
  number: string;
  status: "available" | "reserved" | "holding";
  userId: string | null;
}

interface Booking {
  id: string;
  pnr: string;
  flightId: string;
  passengerId: string;
  seatNo: string;
  status: "Pending" | "Confirmed" | "Cancelled";
  ticketNo?: string;
  createdAt: string;
  passengerName?: string;
}

interface ConsoleEvent {
  id: string;
  timestamp: string;
  category: "CQRS" | "ORLEANS" | "DATABASE" | "RABBITMQ" | "NOTIFICATION";
  title: string;
  message: string;
  level: "success" | "warning" | "error" | "info";
  traceId: string;
}

const FLIGHT_METADATA: Record<string, { origin: string; destination: string; time: string; aircraft: string }> = {
  "OR101": { origin: "LHR (London)", destination: "JFK (New York)", time: "14:30 EST", aircraft: "Airbus A350-1000" },
  "OR202": { origin: "CDG (Paris)", destination: "HND (Tokyo)", time: "19:15 JST", aircraft: "Boeing 787-9 Dreamliner" },
  "OR303": { origin: "DXB (Dubai)", destination: "LHR (London)", time: "08:45 GMT", aircraft: "Airbus A380 Superjumbo" },
  "OR404": { origin: "JFK (New York)", destination: "CDG (Paris)", time: "22:00 EST", aircraft: "Boeing 777-300ER" },
  "OR505": { origin: "HND (Tokyo)", destination: "DXB (Dubai)", time: "00:05 JST", aircraft: "Boeing 787-9 Dreamliner" },
};

function makeTraceId() { return `00-${Math.random().toString(36).substring(2, 8)}-${Math.random().toString(36).substring(2, 6)}`; }

function generatePNR() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let text = "";
  for (let i = 0; i < 6; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text || "PND92A";
}

interface PassengerTerminalProps {
  showAuditTrail?: boolean;
}

export default function PassengerTerminal({ showAuditTrail = true }: PassengerTerminalProps) {
  const [token, setToken] = useState<string>("");
  const [flights, setFlights] = useState<FlightInfo[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>("OR101");
  const [seats, setSeats] = useState<SeatStatus[]>([]);

  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDestination, setSearchDestination] = useState("");
  const [searchedFlights, setSearchedFlights] = useState<FlightInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [activePassengerId, setActivePassengerId] = useState<string>("");
  const [newPassengerName, setNewPassengerName] = useState("");
  const [newPassengerPassport, setNewPassengerPassport] = useState("");
  const [newPassengerEmail, setNewPassengerEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [consoleEvents, setConsoleEvents] = useState<ConsoleEvent[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingFlights, setIsLoadingFlights] = useState(true);
  const [error, setError] = useState("");

  const activeFlight = flights.find(f => f.flightId === selectedFlightId);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleEvents]);

  useEffect(() => {
    login();
  }, []);

  async function login() {
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin" }),
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      setToken(data.accessToken);
      addEvent("CQRS", "Authentication Token Acquired", `JWT issued. Role: ${data.role}. Expires: ${data.expiresIn}s`, "success", makeTraceId());
      loadFlights(data.accessToken);
    } catch (e: any) {
      setError("Cannot connect to backend at " + API + ". Is the API running?");
      addEvent("CQRS", "Auth Failed", e.message, "error", makeTraceId());
    }
  }

  async function loadFlights(authToken?: string) {
    const t = authToken || token;
    if (!t) return;
    setIsLoadingFlights(true);
    try {
      const res = await fetch(`${API}/api/flights`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("Failed to load flights");
      const data = await res.json();
      const enriched = data.map((f: any) => {
        const meta = FLIGHT_METADATA[f.flightId] || FLIGHT_METADATA["OR101"];
        return { ...f, ...meta, flightNumber: f.flightNumber || f.flightId };
      });
      setFlights(enriched);
      setSearchedFlights(enriched);
      addEvent("DATABASE", `Loaded ${enriched.length} flights`, "Flight schedules fetched from backend", "success", makeTraceId());
    } catch (e: any) {
      addEvent("DATABASE", "Failed to load flights", e.message, "error", makeTraceId());
    } finally {
      setIsLoadingFlights(false);
    }
  }

  async function loadSeats(flightId: string) {
    try {
      const res = await fetch(`${API}/api/bookings/flight/${flightId}/seats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load seats");
      const data = await res.json();
      setSeats(data);
      addEvent("ORLEANS", `Seat map loaded for ${flightId}`, `${data.filter((s: SeatStatus) => s.status === "available").length} available`, "info", makeTraceId());
    } catch (e: any) {
      addEvent("ORLEANS", "Failed to load seats", e.message, "error", makeTraceId());
    }
  }

  useEffect(() => {
    if (selectedFlightId && token) {
      setSelectedSeat(null);
      setSeats([]);
      loadSeats(selectedFlightId);
    }
  }, [selectedFlightId, token]);

  async function initFlight() {
    try {
      const res = await fetch(`${API}/api/flights/${selectedFlightId}/initialize?totalSeats=102`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      addEvent("ORLEANS", `Flight ${selectedFlightId} initialized`, data.message || "102 seats created", "success", makeTraceId());
      loadSeats(selectedFlightId);
      loadFlights();
    } catch (e: any) {
      addEvent("ORLEANS", "Init failed", e.message, "error", makeTraceId());
    }
  }

  const handleSearchFlights = (e: React.FormEvent) => {
    e.preventDefault();
    const traceId = makeTraceId();
    addEvent("CQRS", "SearchFlightsQuery", `Origin: "${searchOrigin || "ANY"}", Dest: "${searchDestination || "ANY"}"`, "info", traceId);
    const results = flights.filter(f => {
      const matchesOrigin = !searchOrigin || f.origin.toLowerCase().includes(searchOrigin.toLowerCase());
      const matchesDest = !searchDestination || f.destination.toLowerCase().includes(searchDestination.toLowerCase());
      return matchesOrigin && matchesDest;
    });
    setSearchedFlights(results);
    setHasSearched(true);
    if (results.length > 0 && !results.some(r => r.flightId === selectedFlightId)) {
      setSelectedFlightId(results[0].flightId);
    }
    addEvent("DATABASE", `Found ${results.length} flights`, "Query resolved", "success", traceId);
  };

  const handleResetSearch = () => {
    setSearchOrigin("");
    setSearchDestination("");
    setSearchedFlights(flights);
    setHasSearched(false);
  };

  async function handleRegisterPassenger(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassengerName || !newPassengerPassport) return;
    const traceId = makeTraceId();
    addEvent("CQRS", "CreatePassengerCommand", `Registering ${newPassengerName}`, "info", traceId);
    try {
      const res = await fetch(`${API}/api/passengers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newPassengerName, passportNumber: newPassengerPassport, contactInformation: newPassengerEmail || `${newPassengerName.toLowerCase().replace(/\s+/g, ".")}@email.com` }),
      });
      if (!res.ok) throw new Error("Registration failed");
      const data = await res.json();
      const p: Passenger = {
        id: data.passengerId, name: data.name, passportNumber: data.passportNumber,
        email: newPassengerEmail || `${data.passengerId}@orion.aero`, loyaltyPoints: 0,
      };
      setPassengers(prev => [...prev, p]);
      setActivePassengerId(p.id);
      addEvent("ORLEANS", `PassengerGrain [${p.id}] created`, `Name: ${p.name}`, "success", traceId);
      setNewPassengerName("");
      setNewPassengerPassport("");
      setNewPassengerEmail("");
      setIsRegistering(false);
    } catch (e: any) {
      addEvent("DATABASE", "Registration failed", e.message, "error", traceId);
    }
  }

  async function handleBookSeat() {
    if (!selectedSeat || isBookingInProgress || !activePassengerId) return;
    const passenger = passengers.find(p => p.id === activePassengerId);
    if (!passenger) return;
    setIsBookingInProgress(true);
    const traceId = makeTraceId();
    const pnr = generatePNR();

    addEvent("CQRS", "CreateBookingCommand", `Flight=${selectedFlightId}, Seat=${selectedSeat}, Passenger=${passenger.name}`, "info", traceId);
    addEvent("ORLEANS", `FlightGrain [${selectedFlightId}] lease request`, `Seat ${selectedSeat} — single-thread queue`, "info", traceId);

    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ flightId: selectedFlightId, passengerIds: [passenger.id], seatNumber: selectedSeat }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        addEvent("ORLEANS", "Seat conflict!", data.message || "Already reserved", "error", traceId);
        setSelectedSeat(null);
        setIsBookingInProgress(false);
        loadSeats(selectedFlightId);
        return;
      }

      addEvent("ORLEANS", `Seat ${selectedSeat} RESERVED`, "Orleans actor approved lease", "success", traceId);
      addEvent("DATABASE", "Transactional Outbox committed", "Booking + OutboxEvent saved atomically", "success", traceId);
      addEvent("RABBITMQ", "BookingCreatedEvent published", "Outbox job pushed to RabbitMQ", "success", traceId);
      addEvent("NOTIFICATION", "Ticket issued + notification sent", `Boarding pass ready for ${passenger.name}`, "success", traceId);

      setPassengers(prev => prev.map(p => p.id === passenger.id ? { ...p, loyaltyPoints: p.loyaltyPoints + 500 } : p));

      const bookingId = data.bookingId || selectedFlightId + "-" + Date.now();
      const booking: Booking = {
        id: bookingId,
        pnr: data.pnr || pnr,
        flightId: selectedFlightId,
        passengerId: passenger.id,
        seatNo: selectedSeat,
        status: "Confirmed",
        createdAt: new Date().toLocaleTimeString(),
        passengerName: passenger.name,
      };
      setBookings(prev => [booking, ...prev]);
      setSelectedSeat(null);
      loadSeats(selectedFlightId);
    } catch (e: any) {
      addEvent("DATABASE", "Booking error", e.message, "error", traceId);
    }
    setIsBookingInProgress(false);
  }

  async function handleCancelBooking(bookingId: string) {
    const traceId = makeTraceId();
    addEvent("CQRS", "CancelBookingCommand", `Initiating compensation for ${bookingId}`, "warning", traceId);
    addEvent("ORLEANS", "FlightGrain releasing seat", "Compensation step 1", "info", traceId);
    try {
      const res = await fetch(`${API}/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Cancel failed");
      const data = await res.json();
      addEvent("DATABASE", "Booking cancelled", data.message, "success", traceId);
      addEvent("RABBITMQ", "BookingCancelledEvent published", "Notification sent", "success", traceId);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "Cancelled" } : b));
      loadSeats(selectedFlightId);
    } catch (e: any) {
      addEvent("DATABASE", "Cancel error", e.message, "error", traceId);
    }
  }

  function addEvent(cat: ConsoleEvent["category"], title: string, msg: string, level: ConsoleEvent["level"], traceId: string) {
    setConsoleEvents(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      category: cat, title, message: msg, level, traceId,
    }].slice(-100));
  }

  const currentSeats = seats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#09090b]">
      <div className={`${showAuditTrail ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col gap-6`}>

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 text-red-300 text-xs font-mono">
            <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
          </div>
        )}

        {/* Row 1: Passenger + Flight panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Passenger panel */}
          <div className="bg-[#121217] p-5 rounded-lg border border-[#27272a] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="text-cyan-400 w-4.5 h-4.5" />
                  <h3 className="text-sm font-semibold font-mono uppercase text-gray-200">Traveler Directory</h3>
                </div>
                <button onClick={() => setIsRegistering(!isRegistering)}
                  className="text-[11px] font-mono border border-cyan-800 bg-cyan-950/20 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-950/50 flex items-center gap-1">
                  <Plus className="w-3 h-3" />{isRegistering ? "Cancel" : "New Passenger"}
                </button>
              </div>
              {isRegistering ? (
                <form onSubmit={handleRegisterPassenger} className="space-y-3 bg-black/40 p-3 rounded border border-cyan-950/30">
                  <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wide mb-1 flex items-center gap-1">
                    <ClipboardCheck className="w-3 h-3" /> Add Traveler Profile
                  </div>
                  <input type="text" required placeholder="Full Name" value={newPassengerName}
                    onChange={e => setNewPassengerName(e.target.value)}
                    className="w-full bg-black border border-[#27272a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" required placeholder="Passport Number" value={newPassengerPassport}
                      onChange={e => setNewPassengerPassport(e.target.value)}
                      className="bg-black border border-[#27272a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    <input type="email" placeholder="Email" value={newPassengerEmail}
                      onChange={e => setNewPassengerEmail(e.target.value)}
                      className="bg-black border border-[#27272a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <button type="submit"
                    className="w-full bg-cyan-500 text-black py-1.5 rounded text-xs font-bold hover:bg-cyan-400 font-mono">
                    Save Traveler Profile
                  </button>
                </form>
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {passengers.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs font-mono">
                      No travelers yet. Click "New Passenger" to add one.
                    </div>
                  ) : (
                    passengers.map(p => {
                      const isActive = p.id === activePassengerId;
                      return (
                        <div key={p.id} onClick={() => { if (!isBookingInProgress) { setActivePassengerId(p.id); setSelectedSeat(null); } }}
                          className={`p-3 rounded border cursor-pointer transition-all flex items-center justify-between ${isActive ? "bg-cyan-950/20 border-cyan-500/80 text-cyan-100" : "bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white"}`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${isActive ? "bg-cyan-400 animate-pulse" : "bg-[#27272a]"}`}></div>
                            <div>
                              <div className="text-xs font-medium">{p.name}</div>
                              <div className="text-[10px] font-mono text-gray-500">{p.passportNumber}</div>
                            </div>
                          </div>
                          <span className="text-[10px] bg-cyan-950/40 border border-cyan-900 text-cyan-400 px-1.5 py-0.5 rounded font-mono">{p.loyaltyPoints} pts</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div className="text-[10px] font-mono text-[#71717a] mt-4 pt-4 border-t border-[#27272a]">
              Registered passengers sync with PassengerGrain in Orleans.
            </div>
          </div>

          {/* Flight search panel */}
          <div className="bg-[#121217] p-5 rounded-lg border border-[#27272a] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Plane className="text-cyan-400 w-4.5 h-4.5" />
                  <h3 className="text-sm font-semibold font-mono uppercase text-gray-200">Departing Flights</h3>
                </div>
                {hasSearched && <span className="text-[9px] uppercase font-mono bg-cyan-950/50 border border-cyan-800 text-cyan-400 px-2 py-0.5 rounded-full">Filtered</span>}
              </div>

              <form onSubmit={handleSearchFlights} className="space-y-3 mb-4 bg-black/40 p-3.5 rounded border border-[#27272a]/60">
                <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wide flex items-center gap-1">
                  <Search className="w-3 h-3" /> Filter Routes
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono text-gray-500 uppercase mb-0.5">Origin</label>
                    <input type="text" placeholder="e.g. LHR" value={searchOrigin}
                      onChange={e => setSearchOrigin(e.target.value)}
                      className="w-full bg-black border border-[#27272a] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 uppercase font-mono" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-gray-500 uppercase mb-0.5">Destination</label>
                    <input type="text" placeholder="e.g. JFK" value={searchDestination}
                      onChange={e => setSearchDestination(e.target.value)}
                      className="w-full bg-black border border-[#27272a] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 uppercase font-mono" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit"
                    className="flex-1 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800 text-cyan-400 py-1.5 rounded text-xs font-bold font-mono flex items-center justify-center gap-1.5 cursor-pointer">
                    <Search className="w-3 h-3" /> Find Flights
                  </button>
                  {hasSearched && (
                    <button type="button" onClick={handleResetSearch}
                      className="bg-red-950/20 hover:bg-red-900/20 border border-red-900/50 text-red-400 px-2.5 rounded text-xs font-mono cursor-pointer">
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#71717a] pt-1">
                  <span>Hubs:</span>
                  {["LHR", "JFK", "DXB", "CDG", "HND"].map(hub => (
                    <button key={hub} type="button" onClick={() => setSearchOrigin(hub)}
                      className="hover:text-cyan-400 hover:underline px-0.5 border-none bg-transparent cursor-pointer">{hub}</button>
                  ))}
                </div>
              </form>

              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {isLoadingFlights ? (
                  <div className="text-center py-6 text-gray-500 text-xs font-mono animate-pulse">Loading flights...</div>
                ) : searchedFlights.length === 0 ? (
                  <div className="text-center py-6 bg-black/20 border border-dashed border-[#27272a] rounded text-gray-500 text-xs font-mono">
                    <AlertTriangle className="w-5 h-5 text-amber-500/80 mx-auto mb-1.5" />
                    No flights match your search.
                    <button onClick={handleResetSearch} className="block mx-auto mt-2 text-cyan-400 hover:underline text-[10px]">Clear Filters</button>
                  </div>
                ) : (
                  searchedFlights.map(f => {
                    const isSelected = f.flightId === selectedFlightId;
                    return (
                      <div key={f.flightId} onClick={() => { if (!isBookingInProgress) { setSelectedFlightId(f.flightId); setSelectedSeat(null); } }}
                        className={`p-3 rounded border cursor-pointer transition-all ${isSelected ? "bg-cyan-950/25 border-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.2)]" : "bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white"}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-mono font-bold text-cyan-400">{f.flightNumber}</span>
                          <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-500" /> {f.time}
                          </span>
                        </div>
                        <div className="text-xs flex items-center justify-between text-gray-300 font-medium">
                          <span>{f.origin} ✈ {f.destination}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{f.availableSeats} seats left</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#71717a] mt-4 pt-4 border-t border-[#27272a] flex justify-between">
              <span>Live inventory from FlightGrain actors</span>
              <button onClick={() => initFlight()} className="text-cyan-500 hover:text-cyan-400 underline">Init flight</button>
            </div>
          </div>
        </div>

        {/* Section 2: Seat map */}
        <div className="bg-[#121217] p-6 rounded-lg border border-[#27272a]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#27272a] pb-4 mb-4 gap-4">
            <div>
              <h3 className="text-sm font-bold font-mono uppercase text-gray-200 flex items-center gap-2">
                <Compass className="text-cyan-400 w-4.5 h-4.5" />
                Seat Selection • {activeFlight?.flightNumber || selectedFlightId}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Select a seat to reserve. Real-time data from Orleans FlightGrain.</p>
            </div>
            <div className="flex gap-4 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#18181b] border border-[#27272a] rounded"></div>
                <span className="text-gray-400">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-cyan-950/30 border border-cyan-500 rounded"></div>
                <span className="text-cyan-400">Reserved</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-black rounded border border-[#27272a] overflow-x-auto mb-6">
            <div className="min-w-[600px] flex flex-col gap-2">
              <div className="text-[10px] text-center font-mono text-gray-500 py-1 border-b border-dashed border-[#27272a] mb-2 uppercase tracking-widest">
                ▲ COCKPIT / FIRST CLASS ▲
              </div>
              <div className="grid grid-cols-10 gap-2">
                {currentSeats.length === 0 ? (
                  <div className="col-span-10 text-center py-8 text-gray-500 text-xs font-mono">No seat data. Click "Init flight" to create seats.</div>
                ) : (
                  currentSeats.map((seat, index) => {
                    const isReserved = seat.status === "reserved";
                    const isSelected = selectedSeat === seat.number;
                    return (
                      <div key={index} onClick={() => { if (!isReserved && !isBookingInProgress) setSelectedSeat(isSelected ? null : seat.number); }}
                        className={`py-2 text-center rounded border transition-all duration-200 font-mono text-xs ${isReserved ? "bg-cyan-950/25 border-cyan-600/70 text-cyan-400 opacity-80 cursor-not-allowed" : isSelected ? "bg-cyan-500 border-cyan-500 text-black font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.5)] cursor-pointer" : "bg-[#18181b] border-[#27272a] text-gray-400 hover:border-cyan-500/50 hover:text-white cursor-pointer"}`}
                        title={`${seat.number} - ${isReserved ? "Reserved" : "Available"}`}>
                        <span className="block text-[10px] font-bold">{seat.number}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="text-[10px] text-center font-mono text-gray-500 py-1 border-t border-dashed border-[#27272a] mt-2 uppercase tracking-widest">
                ▼ REAR CABIN / ECONOMY ▼
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-cyan-950/10 border border-cyan-900/30 rounded-lg">
            <div>
              <div className="text-xs font-bold text-gray-200 font-mono uppercase">
                {selectedSeat ? `Selected: ${selectedSeat}` : "No seat selected"}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                {selectedSeat ? "Confirm to issue boarding pass via Orleans booking saga." : "Select a green seat above."}
              </div>
            </div>
            <button onClick={handleBookSeat} disabled={!selectedSeat || isBookingInProgress || !activePassengerId}
              className={`px-5 py-2.5 rounded font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${selectedSeat && !isBookingInProgress && activePassengerId ? "bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer" : "bg-[#27272a] text-gray-500 cursor-not-allowed"}`}>
              {isBookingInProgress ? <><Clock className="w-4 h-4 animate-spin" /> Confirming...</> : <><Send className="w-4 h-4" /> Confirm & Issue Ticket</>}
            </button>
          </div>
        </div>

        {/* Section 3: Boarding passes */}
        <div className="bg-[#121217] p-5 rounded-lg border border-[#27272a]">
          <div className="flex items-center gap-2 mb-4 border-b border-[#27272a] pb-3">
            <Ticket className="text-cyan-400 w-4.5 h-4.5" />
            <h3 className="text-sm font-semibold font-mono uppercase text-gray-200">Your Boarding Passes</h3>
          </div>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs font-mono">
              No bookings yet. Select a seat and book!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {bookings.map(b => {
                  const passenger = passengers.find(p => p.id === b.passengerId);
                  const flight = flights.find(f => f.flightId === b.flightId);
                  const isCancelled = b.status === "Cancelled";
                  return (
                    <motion.div key={b.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                      className={`relative overflow-hidden rounded-lg border bg-[#18181b] flex flex-col justify-between ${isCancelled ? "border-red-950/40 opacity-55 text-gray-500" : "border-[#27272a] text-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"}`}>
                      <div className="absolute right-[30%] top-0 bottom-0 border-l border-dashed border-[#27272a]"></div>
                      <div className="p-4 flex-1">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-mono text-cyan-400">{b.id}</span>
                          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full ${isCancelled ? "bg-red-950/20 text-red-500 border border-red-900/40" : "bg-cyan-950/30 text-cyan-400 border border-cyan-800/60"}`}>{b.status}</span>
                        </div>
                        <div className="my-2">
                          <div className="text-xs font-mono text-gray-400 uppercase tracking-tight">ROUTE</div>
                          <div className="text-sm font-bold flex items-center gap-1">
                            <span>{flight?.origin?.split(" ")[0] || b.flightId}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-cyan-500" />
                            <span>{flight?.destination?.split(" ")[0] || ""}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-3 text-xs">
                          <div><span className="text-[10px] text-gray-500 block">PASSENGER</span><span className="font-medium truncate block">{passenger?.name || b.passengerName}</span></div>
                          <div><span className="text-[10px] text-gray-500 block">SEAT</span><span className="font-mono font-bold text-cyan-400 block">{b.seatNo}</span></div>
                          <div><span className="text-[10px] text-gray-500 block">PNR</span><span className="font-mono font-bold text-[#f59e0b] block">{b.pnr}</span></div>
                        </div>
                      </div>
                      <div className="border-t border-[#27272a] bg-black/45 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-500">{b.createdAt}</span>
                        {!isCancelled && (
                          <button onClick={() => handleCancelBooking(b.id)}
                            className="text-[10px] font-mono font-bold text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-950/20 border border-red-900/30 px-2 py-1 rounded transition-all">
                            <Trash2 className="w-3 h-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Right column: Audit trail */}
      {showAuditTrail && (
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#121217] rounded-lg border border-[#27272a] flex flex-col h-[650px] lg:h-full min-h-[450px]">
            <div className="p-4 border-b border-[#27272a] bg-black/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="text-cyan-400 w-4 h-4" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-300">Booking Pipeline Audit Trail</h3>
              </div>
              <button onClick={() => setConsoleEvents([])}
                className="text-[10px] font-mono border border-[#27272a] bg-[#1a1212] text-red-400/80 hover:text-red-400 px-2 py-0.5 rounded transition-all">Clear</button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-2 bg-black/50 border-b border-[#27272a] text-[9px] font-mono text-center text-[#71717a]">
              <div className="border-r border-[#18181b] text-blue-400">User Action</div>
              <div className="border-r border-[#18181b] text-yellow-500">Orleans</div>
              <div className="border-r border-[#18181b] text-emerald-400">Database</div>
              <div className="text-purple-400">Event Bus</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 font-mono text-xs">
              {consoleEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-4">
                  <ShieldCheck className="w-8 h-8 text-cyan-600/50 mb-2" />
                  <span className="text-[10px] uppercase tracking-wider">Processor Standing By</span>
                  <span className="text-[9px] text-gray-600 mt-1">Real-time saga steps will stream here as you interact.</span>
                </div>
              ) : (
                consoleEvents.map(e => {
                  let badgeClass = "text-blue-400 border border-blue-900/40 bg-blue-950/10";
                  let icon = <Database className="w-3 h-3 text-blue-400" />;
                  if (e.category === "ORLEANS") { badgeClass = "text-yellow-500 border border-yellow-900/40 bg-yellow-950/10"; icon = <Cpu className="w-3 h-3 text-yellow-500" />; }
                  else if (e.category === "DATABASE") { badgeClass = "text-emerald-400 border border-emerald-900/45 bg-emerald-950/10"; icon = <Database className="w-3 h-3 text-emerald-400" />; }
                  else if (e.category === "RABBITMQ") { badgeClass = "text-purple-400 border border-purple-900/45 bg-purple-950/10"; icon = <Radio className="w-3 h-3 text-purple-400" />; }
                  else if (e.category === "NOTIFICATION") { badgeClass = "text-cyan-400 border border-cyan-900/40 bg-cyan-950/10"; icon = <Send className="w-3 h-3 text-cyan-400" />; }
                  return (
                    <div key={e.id} className="p-3 bg-black/40 rounded border border-[#27272a] text-[11px] leading-relaxed relative overflow-hidden group">
                      <div className="absolute right-1 top-1 text-[9px] text-[#71717a] group-hover:text-[#a1a1aa] transition-all font-mono">{e.traceId}</div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold font-mono ${badgeClass} inline-flex items-center gap-1`}>{icon}{e.category}</span>
                        <span className="text-gray-500 text-[10px]">{e.timestamp}</span>
                      </div>
                      <div className="font-bold text-gray-200 text-xs mb-1">{e.title}</div>
                      <div className="text-gray-400 font-mono text-[10.5px]">{e.message}</div>
                    </div>
                  );
                })
              )}
              <div ref={consoleEndRef} />
            </div>
            <div className="p-3 border-t border-[#27272a] bg-black/35 flex items-center justify-between text-[10px] font-mono text-[#71717a]">
              <span>Audit Trail: Active</span>
              <span>Backend: {API}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
