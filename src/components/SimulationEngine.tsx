/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Zap, Play, RotateCcw, ShieldCheck, AlertTriangle, CheckCircle, 
  Activity, Database, Server, RefreshCw
} from "lucide-react";
import { SimulationLog, SystemMetrics, SeatStatus } from "../types";

export default function SimulationEngine() {
  const [concurrencyLevel, setConcurrencyLevel] = useState<number>(1000);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(30); // ms delay
  const [useSagaCompensation, setUseSagaCompensation] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simCompleted, setSimCompleted] = useState<boolean>(false);

  // Flight states
  const FLIGHT_CAPACITY = 100;
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalRequests: 0,
    successfulBookings: 0,
    failedBookings: 0,
    doubleBookingsPrevented: 0,
    avgLatencyMs: 0,
    activeOrleansActors: 1,
    outboxPending: 0,
    outboxPublished: 0,
    redisHits: 0,
    redisMisses: 0
  });

  const [logs, setLogs] = useState<SimulationLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initialize Seats on load
  useEffect(() => {
    resetSimulation();
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const resetSimulation = () => {
    setIsSimulating(false);
    setSimCompleted(false);

    // Dynamic clean client seat configuration:
    const initialSeats: SeatStatus[] = [];
    const rows = ["A", "B", "C", "D", "E", "F"];
    let count = 0;
    for (let r = 1; r <= 17 && count < FLIGHT_CAPACITY; r++) {
      for (const rowLetter of rows) {
        if (count < FLIGHT_CAPACITY) {
          initialSeats.push({
            number: `${r}${rowLetter}`,
            status: "available",
            userId: null
          });
          count++;
        }
      }
    }
    setSeats(initialSeats);
    setMetrics({
      totalRequests: 0,
      successfulBookings: 0,
      failedBookings: 0,
      doubleBookingsPrevented: 0,
      avgLatencyMs: 0,
      activeOrleansActors: 1,
      outboxPending: 0,
      outboxPublished: 0,
      redisHits: 1,
      redisMisses: 0
    });
    setLogs([
      {
        timestamp: new Date().toLocaleTimeString(),
        service: "Orleans Cluster",
        message: "FlightGrain (Flight ID: OR-902) rehydrated. State: TotalSeats=100. Locks released.",
        level: "success",
        traceId: "00-initial-01"
      },
      {
        timestamp: new Date().toLocaleTimeString(),
        service: "Redis Cache",
        message: "Cached route flight-search:JFK:LAX:2026-06-08 initialized with TTL=300s",
        level: "info",
        traceId: "00-initial-02"
      }
    ]);
  };

  const runSimulation = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimCompleted(false);

    addLog("Gateway", `Commencing backend high-concurrency run: ${concurrencyLevel} rapid-burst requests on OR-902.`, "info");

    let currentDispatched = 0;
    let successful = 0;
    let doubleBookingsBlocked = 0;
    let failedDueToFull = 0;
    let pendingOutbox = 0;
    let publishedOutbox = 0;

    const updatedSeats = [...seats];
    const makeTrace = () => `00-${Math.random().toString(36).substring(2, 8)}-${Math.random().toString(36).substring(2, 4)}`;

    for (let pIdx = 0; pIdx < concurrencyLevel; pIdx++) {
      const wantsPremium = Math.random() < 0.6;
      let seatIndex = 0;
      if (wantsPremium) {
        // Front rows has heightened collision chances
        seatIndex = Math.floor(Math.random() * 20);
      } else {
        // Uniform seat distribution
        seatIndex = Math.floor(Math.random() * FLIGHT_CAPACITY);
      }

      const passengerId = `usr_${Math.floor(1000 + Math.random() * 9000)}`;
      const targetSeat = updatedSeats[seatIndex];
      const traceId = makeTrace();

      currentDispatched++;

      if (targetSeat.status === "available") {
        targetSeat.status = "reserved";
        targetSeat.userId = passengerId;
        successful++;
        pendingOutbox++;

        addLog(
          "Orleans Grain", 
          `[IFlightGrain] Approved: Seat ${targetSeat.number} leased to passenger ${passengerId} (Orleans serialization turn sequence).`, 
          "success",
          traceId
        );

        addLog(
          "Booking Db", 
          `EF Transaction Complete: Booking confirm saved and OutboxMessage queued (Event: BookingCreated).`, 
          "success",
          traceId
        );

        setTimeout(() => {
          pendingOutbox = Math.max(0, pendingOutbox - 1);
          publishedOutbox++;
          setMetrics(prev => ({
            ...prev,
            outboxPending: Math.max(0, prev.outboxPending - 1),
            outboxPublished: prev.outboxPublished + 1
          }));
          addLog("RabbitMQ", `Published BookingCreatedEvent to booking-exchange [ROUTING KEY: ord.created]`, "info", traceId);
        }, 120 + Math.random() * 200);

      } else {
        doubleBookingsBlocked++;
        addLog(
          "Orleans Grain", 
          `[IFlightGrain] REJECTED: Concurrency Collision on Seat ${targetSeat.number}. Actor turn blocked duplicate allocation.`, 
          "error", 
          traceId
        );

        if (useSagaCompensation) {
          addLog(
            "Saga Manager", 
            `Executing rollback chain on user booking. Triggering compensations. Status marked CANCELLED.`, 
            "warning",
            traceId
          );
        }
      }

      if (pIdx % 12 === 0 || pIdx === concurrencyLevel - 1) {
        setSeats([...updatedSeats]);
        setMetrics({
          totalRequests: currentDispatched,
          successfulBookings: successful,
          doubleBookingsPrevented: doubleBookingsBlocked,
          failedBookings: failedDueToFull,
          avgLatencyMs: Math.floor(12 + (pIdx / concurrencyLevel) * 11),
          activeOrleansActors: 1 + Math.ceil(successful / 10),
          outboxPending: pendingOutbox,
          outboxPublished: publishedOutbox,
          redisHits: 12 + pIdx,
          redisMisses: 1
        });
        await new Promise(resolve => setTimeout(resolve, simulationSpeed));
      }
    }

    addLog("Saga Manager", `Simulation complete. Concurrency load test processed. 0 double-bookings occurred!`, "success");
    setIsSimulating(false);
    setSimCompleted(true);
  };

  const handleSeatClick = (seat: SeatStatus) => {
    if (seat.status !== "available" || isSimulating) return;

    // Direct dynamic leasing workflow:
    setSeats(seats.map(s => s.number === seat.number ? { ...s, status: "reserved" as const, userId: "usr_client_manual" } : s));
    setMetrics(prev => ({
      ...prev,
      totalRequests: prev.totalRequests + 1,
      successfulBookings: prev.successfulBookings + 1,
      outboxPending: prev.outboxPending + 1,
    }));

    const traceId = `00-${Math.random().toString(36).substring(2, 8)}-manual`;
    addLog("Orleans Grain", `[IFlightGrain] Approved: Manual Seat lease ${seat.number} locked by Orleans turn loop context.`, "success", traceId);
    addLog("Booking Db", `EF Transaction Complete: Saved booking entry for Seat ${seat.number}. Outbox queued.`, "success", traceId);

    setTimeout(() => {
      setMetrics(prev => ({
        ...prev,
        outboxPending: Math.max(0, prev.outboxPending - 1),
        outboxPublished: prev.outboxPublished + 1,
      }));
      addLog("RabbitMQ", `Published BookingCreatedEvent to booking-exchange [ROUTING KEY: ord.created]`, "info", traceId);
    }, 150);
  };

  const addLog = (service: string, message: string, level: "info" | "success" | "warning" | "error", traceId?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: SimulationLog = {
      timestamp,
      service,
      message,
      level,
      traceId: traceId || "System-Core"
    };
    setLogs(prev => [...prev.slice(-300), newLog]);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      
      {/* Simulation Controls Sidebar */}
      <div className="xl:col-span-1 bg-[#121217] border border-[#27272a] rounded-lg p-5 flex flex-col justify-between space-y-6">
        <div>
          <h4 className="font-mono text-xs uppercase text-[#71717a] tracking-widest mb-4">Simulation Control</h4>
          
          <div className="space-y-4">
            {/* Concurrency Level Slider */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1.5 flex justify-between">
                <span>Concurrent Request Volume</span>
                <span className="text-cyan-400 font-bold">{concurrencyLevel} users</span>
              </label>
              <input 
                type="range" 
                min="50" 
                max="2000" 
                step="50"
                value={concurrencyLevel} 
                onChange={(e) => setConcurrencyLevel(parseInt(e.target.value))}
                disabled={isSimulating}
                className="w-full accent-cyan-500 bg-[#27272a] rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 block mt-1 font-mono">Simulates passengers attempting to book flights at the exact same millisecond.</span>
            </div>

            {/* Delay Speed Slider */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1.5 flex justify-between">
                <span>Iteration Throttle</span>
                <span className="text-cyan-400">{simulationSpeed} ms/batch</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="150" 
                value={simulationSpeed} 
                onChange={(e) => setSimulationSpeed(parseInt(e.target.value))}
                disabled={isSimulating}
                className="w-full accent-cyan-500 bg-[#27272a] rounded-lg appearance-none h-1.5 cursor-pointer"
              />
            </div>

            {/* Saga Checkbox */}
            <div className="flex items-center justify-between p-3 bg-black rounded border border-[#27272a]">
              <div>
                <span className="text-xs font-mono text-gray-300 block">Saga Compensation</span>
                <span className="text-[10px] text-gray-500 block font-mono">Rollback if seat is claimed</span>
              </div>
              <input 
                type="checkbox" 
                checked={useSagaCompensation}
                onChange={(e) => setUseSagaCompensation(e.target.checked)}
                disabled={isSimulating}
                className="w-4 h-4 text-cyan-500 border-gray-600 rounded bg-[#1e1e24] focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Action Button Stations */}
        <div className="space-y-2">
          {isSimulating ? (
            <button 
              onClick={() => setIsSimulating(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-mono py-2.5 rounded text-xs transition duration-200 flex items-center justify-center gap-2 font-semibold cursor-pointer"
            >
              <Activity className="w-4 h-4 animate-pulse" />
              Abort Sim Engine
            </button>
          ) : (
            <button 
              onClick={runSimulation}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-mono font-bold py-2.5 cursor-pointer rounded text-xs transition duration-200 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] glow-btn"
            >
              <Play className="fill-current w-3.5 h-3.5" />
              Begin {concurrencyLevel}-User Seat Rush
            </button>
          )}

          <button 
            onClick={resetSimulation}
            disabled={isSimulating}
            className="w-full border border-[#27272a] hover:border-gray-500 bg-black text-gray-300 font-mono py-2 rounded text-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Flight Seats
          </button>
        </div>

        {/* Live system architecture notes */}
        <div className="p-3 bg-cyan-950/20 rounded border border-cyan-800/40 text-[10.5px] leading-relaxed text-cyan-400 font-mono">
          <span className="font-bold flex items-center gap-1.5 mb-1 text-cyan-100">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Orleans Coherence Guard
          </span>
          Because Orleans actors lease state updates within single-threaded turn queues on the Silo grain backplane, race conditions are mathematically precluded.
        </div>
      </div>

      {/* Main Simulation View Area */}
      <div className="xl:col-span-3 space-y-6">
        
        {/* Dynamic Live Scoreboard Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          <div className="bg-[#121217] border border-[#27272a] rounded-lg p-3.5">
            <span className="text-[10px] font-mono uppercase text-gray-500 block">Total Requests Sent</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-gray-200">{metrics.totalRequests}</span>
              <span className="text-[10.5px] text-gray-500 font-mono">/ {concurrencyLevel}</span>
            </div>
            <div className="w-full bg-black h-1 rounded mt-2.5 overflow-hidden">
              <div 
                className="bg-cyan-500 h-full transition-all duration-300 shadow-[0_0_5px_rgba(6,182,212,0.8)]" 
                style={{ width: `${Math.min(100, (metrics.totalRequests / concurrencyLevel) * 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-[#121217] border border-[#27272a] rounded-lg p-3.5">
            <span className="text-[10px] font-mono uppercase text-emerald-400 block">Successful Leases</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">{metrics.successfulBookings}</span>
              <span className="text-[10.5px] text-emerald-600 font-mono">/ 100 max</span>
            </div>
            <div className="w-full bg-black h-1 rounded mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full transition-all duration-300" 
                style={{ width: `${(metrics.successfulBookings / FLIGHT_CAPACITY) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-[#121217] border border-[#27272a] rounded-lg p-3.5">
            <span className="text-[10px] font-mono uppercase text-red-400 block">Overbookings Avoided</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-cyan-400">{metrics.doubleBookingsPrevented}</span>
              <span className="text-[10.5px] text-red-500/80 font-mono">Locked Calls</span>
            </div>
            <div className="w-full bg-black h-1 rounded mt-2.5 overflow-hidden">
              <div 
                className="bg-cyan-500 h-full transition-all duration-300" 
                style={{ width: `${metrics.totalRequests > 0 ? (metrics.doubleBookingsPrevented / metrics.totalRequests) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-[#121217] border border-[#27272a] rounded-lg p-3.5">
            <span className="text-[10px] font-mono uppercase text-cyan-500 block">Avg DB Latency</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">{metrics.avgLatencyMs}</span>
              <span className="text-[10.5px] text-gray-500 font-mono">ms</span>
            </div>
            <div className="w-full bg-black h-1 rounded mt-2.5 overflow-hidden">
              <div className="bg-emerald-400 h-full" style={{ width: "25%" }}></div>
            </div>
          </div>

        </div>

        {/* Seats Map Layout Visualizer */}
        <div className="bg-[#121217] border border-[#27272a] rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h5 className="text-xs font-mono uppercase text-gray-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-cyan-500 rounded-sm inline-block shadow-[0_0_5px_rgba(6,182,212,0.8)]"></span>
                Flight OR-902 Live Cabin Seat Map
              </h5>
              <p className="text-[10.5px] text-gray-500 font-mono mt-0.5">Boeing 787 Premium Layout (Total: 100 Grains Seats)</p>
            </div>
            
            {/* Status legends */}
            <div className="flex gap-4 text-[10px] font-mono">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-[#18181c] border border-[#27272a] rounded-sm"></span>
                <span className="text-gray-400">Available</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-cyan-950/20 border border-cyan-500 rounded-sm shadow-[0_0_5px_rgba(6,182,212,0.3)]"></span>
                <span className="text-cyan-400">Leased (Actor)</span>
              </div>
            </div>
          </div>

          {/* Graphical rendering of seats block grid */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-3 bg-black rounded border border-[#27272a] overflow-x-auto">
            {seats.map((seat, index) => {
              const isLocked = seat.status === "reserved";
              const isHolding = seat.status === "holding";
              return (
                <div 
                  key={index}
                  onClick={() => handleSeatClick(seat)}
                  className={`py-1.5 text-center rounded border transition-all duration-200 font-mono ${
                    isLocked 
                      ? "bg-cyan-950/20 border-cyan-500 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)] cursor-not-allowed" 
                      : isHolding
                      ? "bg-yellow-950/20 border-yellow-500 text-yellow-500 animate-pulse cursor-wait"
                      : "bg-[#121217] border-[#27272a] text-[#71717a] hover:border-cyan-500/60 hover:text-white cursor-pointer"
                  }`}
                  title={`${seat.number} - ${isLocked ? `Passenger: ${seat.userId}` : isHolding ? "Leasing..." : "Click to lease this seat dynamically"}`}
                >
                  <span className="text-[10px] block font-bold">{seat.number}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Telemetry log tracer streams */}
        <div className="bg-[#121217] border border-[#27272a] rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <span className="text-xs font-mono uppercase text-gray-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              Real-time Silo Coherence Traces
            </span>
            <span className="text-[10.5px] font-mono text-gray-500">
              Database Outbox: {metrics.outboxPending} Pending | {metrics.outboxPublished} Published
            </span>
          </div>

          {/* Output log view box */}
          <div className="bg-black border border-[#27272a] rounded p-4 h-[220px] overflow-y-auto block space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2.5 border-b border-black pb-1 text-[11px] font-mono leading-relaxed">
                <span className="text-gray-600 shrink-0 select-none">{log.timestamp}</span>
                
                <span className={`px-1.5 py-0.5 rounded-sm uppercase font-extrabold shrink-0 text-[9px] tracking-tight ${
                  log.service === "Gateway" ? "bg-cyan-950/45 text-cyan-400 border border-cyan-900/60" :
                  log.service === "Orleans Grain" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50" :
                  log.service === "Saga Manager" ? "bg-red-950/30 text-red-400 border border-red-900/40" :
                  log.service === "Booking Db" ? "bg-zinc-900 text-gray-300 border border-zinc-800" :
                  log.service === "RabbitMQ" ? "bg-cyan-950/20 text-cyan-400" :
                  "bg-neutral-800 text-gray-400"
                }`}>
                  {log.service}
                </span>

                <span className="flex-1 text-gray-300">
                  {log.message}
                </span>

                <span className="text-gray-600 block text-[10px] shrink-0 font-light select-all">
                  Trace: {log.traceId}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
