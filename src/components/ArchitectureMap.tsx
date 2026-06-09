/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Network, Server, Shield, Database, Radio, Mail, 
  Cpu, Key, Cloud, Clock, RefreshCw, Layers, ArrowRight, Zap 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NodeDetails {
  id: string;
  label: string;
  type: "gateway" | "service" | "db" | "broker" | "cache" | "actor";
  description: string;
  endpoints?: string[];
  metrics?: { label: string; value: string }[];
  techStack: string;
}

const NODES: Record<string, NodeDetails> = {
  gateway: {
    id: "gateway",
    label: "YARP Reverse Gateway",
    type: "gateway",
    techStack: "YARP Core, .NET 9, JWT Auth, Redis Limiter",
    description: "Acts as the unified entrance point. Validates JWT signature, handles distributed rate limiting, correlation ID injection, and intelligent load-balanced path proxies.",
    endpoints: ["POST /api/v1/bookings", "GET /api/v1/flights", "GET /health/ready"],
    metrics: [{ label: "Avg Latency", value: "4.2 ms" }, { label: "Request Rate", value: "982 req/s" }]
  },
  flight_service: {
    id: "flight_service",
    label: "Flight Service Web API",
    type: "service",
    techStack: "ASP.NET Core Web API, EF Core, SQL Server",
    description: "Supports search queries and reads on flights, communicating with Orleans FlightGrains to verify live allocations and caching listings inside Redis.",
    endpoints: ["GET /api/v1/flights/search", "POST /api/v1/flights"],
    metrics: [{ label: "RAM Usage", value: "312 MB" }, { label: "DB Connections", value: "24/100" }]
  },
  booking_service: {
    id: "booking_service",
    label: "Booking Service Host",
    type: "service",
    techStack: "ASP.NET Core, CQRS (MediatR), Orleans Client",
    description: "Orchestrates booking aggregate state transitions. Spidery-hands client connecting to Orleans Grains. Inserts messages into Transactional Outbox tables.",
    endpoints: ["POST /api/v1/bookings", "GET /api/v1/bookings/{id}"],
    metrics: [{ label: "Active Sagas", value: "42" }, { label: "Outbox Queue", value: "0 ms status" }]
  },
  orleans_cluster: {
    id: "orleans_cluster",
    label: "Orleans Silo Cluster",
    type: "actor",
    techStack: "Microsoft Orleans 9.0 (Dynamic Coherence, ADO.NET Clustering)",
    description: "Highly scalable Virtual Actor mesh hosting IFlightGrain and IBookingGrain. Single-threaded turn-based executions mathematically prevent seat over-allocations.",
    endpoints: ["Orleans Client Co-host IPC", "Silo-to-Silo Internal Port: 11111"],
    metrics: [{ label: "Active Grains", value: "4,102 rehydrated" }, { label: "Turn Latency", value: "0.45 ms" }]
  },
  rabbitmq: {
    id: "rabbitmq",
    label: "RabbitMQ Message Broker",
    type: "broker",
    techStack: "RabbitMQ Topic Exchange & DLQ queues",
    description: "Routes distributed events ('BookingCreated', 'SeatReserved') between services. Employs dead-letter queue routing for idempotent background safety.",
    endpoints: ["Topic: booking.exchange", "Queues: ticket.issuance, notification.request"],
    metrics: [{ label: "Ack Ratio", value: "100%" }, { label: "Message Delivery", value: "0 delay" }]
  },
  ticket_service: {
    id: "ticket_service",
    label: "Ticket Service Daemon",
    type: "service",
    techStack: "Worker Services, EF Core, Idempotent Inbox Worker",
    description: "Asynchronously consumes Event messages. Executes the actual high-reliability PDF/barcode receipt creation inside separate database contexts.",
    endpoints: ["RabbitMQ TicketRequest Consumer"],
    metrics: [{ label: "Ticket Creation", value: "12 ms" }, { label: "Inbox Deduplication", value: "0 bypass" }]
  },
  notification_service: {
    id: "notification_service",
    label: "Notification Service",
    type: "service",
    techStack: ".NET Worker, SMTP / Twilio Clients",
    description: "Reacts on ticket delivery events. Dispatches e-mail confirmations, flight schedules, and PNR notifications safely back to travelers.",
    endpoints: ["RabbitMQ Queue Consumer"],
    metrics: [{ label: "Sent Emails", value: "4.5k/hr" }, { label: "Delivery Ratio", value: "99.9%" }]
  },
  redis: {
    id: "redis",
    label: "Redis Cache Cluster",
    type: "cache",
    techStack: "StackExchange.Redis, Cluster Active Repl",
    description: "Provides sub-20ms flight listing caches using intelligent TTL configurations alongside rate limiter policies to buffer database constraints.",
    metrics: [{ label: "Memory used", value: "45 MB" }, { label: "Hit Ratio", value: "94.2%" }]
  },
  sql_server: {
    id: "sql_server",
    label: "SQL Server (Multi-Tenant)",
    type: "db",
    techStack: "Microsoft SQL Server 2022, Isolation Locks",
    description: "Durable database persistence holding physical aggregate status, ledger audits, transactional inbox histories, and dynamic clustering configurations.",
    metrics: [{ label: "Transaction Latency", value: "8 ms" }, { label: "Space Available", value: "82%" }]
  }
};

export default function ArchitectureMap() {
  const [selectedNode, setSelectedNode] = useState<string>("gateway");
  const [activeFlow, setActiveFlow] = useState<boolean>(false);

  const nodeObj = NODES[selectedNode];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Visual System Architecture Diagram */}
      <div className="lg:col-span-2 bg-[#121217] border border-[#27272a] rounded-lg p-6 flex flex-col justify-between relative overflow-hidden min-h-[500px]">
        {/* Background Grid Lines decorative */}
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

        <div className="z-10 flex justify-between items-center mb-6">
          <div>
            <h3 className="font-mono text-xs uppercase text-[#71717a] tracking-wider">Topology Visualizer</h3>
            <p className="text-xs text-[#a1a1aa] font-mono">Select a component hub to pull live architecture constraints</p>
          </div>
          <button 
            onClick={() => {
              setActiveFlow(true);
              setTimeout(() => setActiveFlow(false), 5000);
            }}
            disabled={activeFlow}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-all border ${
              activeFlow 
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                : "bg-black border-[#27272a] text-gray-300 hover:border-cyan-500/50 hover:bg-[#121217] glow-btn"
            }`}
          >
            {activeFlow ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                Tracing CreateBooking Flow...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                Trace CreateBooking Request
              </>
            )}
          </button>
        </div>

        {/* The Node Network Map */}
        <div className="z-10 flex-1 flex flex-col justify-center relative min-h-[360px] p-4">
          
          {/* Visual paths representing logical microservice connections */}
          <div className="absolute inset-0 pointer-events-none">
            {/* SVG Drawing connections */}
            <svg className="w-full h-full" style={{ minHeight: "340px" }}>
              <defs>
                <linearGradient id="activeTrace" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                  <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Layout Paths */}
              {/* Gateway to Flight Service */}
              <line x1="25%" y1="20%" x2="55%" y2="20%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />
              {/* Gateway to Booking Service */}
              <line x1="25%" y1="20%" x2="55%" y2="50%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />

              {/* Booking Service to Orleans Silo */}
              <line x1="55%" y1="50%" x2="85%" y2="35%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />
              {/* Flight Service to Orleans Silo */}
              <line x1="55%" y1="20%" x2="85%" y2="35%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />

              {/* Booking/Flight Services to Local databases */}
              <line x1="55%" y1="20%" x2="55%" y2="80%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />
              {/* Services to Caching Redis */}
              <line x1="55%" y1="20%" x2="25%" y2="80%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />
              <line x1="55%" y1="50%" x2="25%" y2="80%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />

              {/* Booking Service Outbox to RabbitMQ */}
              <line x1="55%" y1="50%" x2="85%" y2="65%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />

              {/* RabbitMQ to Ticket & Email Workers */}
              <line x1="85%" y1="65%" x2="85%" y2="90%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />
              <line x1="85%" y1="65%" x2="55%" y2="90%" stroke="#27272a" strokeWidth="2" strokeDasharray="3" />

              {/* Animated trace sequence if user executes a trace */}
              {activeFlow && (
                <>
                  {/* Gateway -> Booking Service */}
                  <path d="M 120 70 L 290 170" fill="none" stroke="#06b6d4" strokeWidth="3" strokeDasharray="10 10" className="animate-[dash_2s_linear_infinite]" />
                  {/* Booking Service -> Orleans Silo */}
                  <path d="M 290 170 L 450 120" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="10 10" className="animate-[dash_2s_linear_infinite]" />
                  {/* Booking Service -> Database (Outbox Insertion) */}
                  <path d="M 290 170 L 290 270" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="10 10" className="animate-[dash_2s_linear_infinite]" />
                  {/* Database (Processed Outbox) -> RabbitMQ */}
                  <path d="M 290 170 L 450 220" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="10 10" className="animate-[dash_2s_linear_infinite]" />
                  {/* RabbitMQ -> Ticket Service */}
                  <path d="M 450 220 L 450 310" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="10 10" className="animate-[dash_2s_linear_infinite]" />
                </>
              )}
            </svg>
          </div>

          <style>{`
            @keyframes dash {
              to {
                stroke-dashoffset: -40;
              }
            }
          `}</style>

          {/* Core Interactive Node Stations (Absolutely Configured UI Hubs) */}
          <div className="grid grid-cols-3 gap-y-12 gap-x-6 relative">
            
            {/* Top Row: User / Gateway Zone */}
            <div className="flex flex-col items-center">
              <button 
                id="node-gateway"
                onClick={() => setSelectedNode("gateway")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "gateway" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan animate-pulse" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Shield className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">Gateway (YARP)</span>
            </div>

            {/* Flight Web API Node */}
            <div className="flex flex-col items-center">
              <button 
                id="node-flight-service"
                onClick={() => setSelectedNode("flight_service")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "flight_service" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Server className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">Flight API</span>
            </div>

            {/* Orleans Silent Actor Cluster */}
            <div className="flex flex-col items-center">
              <button 
                id="node-orleans"
                onClick={() => setSelectedNode("orleans_cluster")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "orleans_cluster" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Cpu className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">Orleans Cluster</span>
            </div>

            {/* Second Row: Caches & Booking Sagas */}
            <div className="flex flex-col items-center">
              <button 
                id="node-redis"
                onClick={() => setSelectedNode("redis")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "redis" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Clock className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">Redis Cache</span>
            </div>

            {/* Core Booking Host Container */}
            <div className="flex flex-col items-center">
              <button 
                id="node-booking-service"
                onClick={() => setSelectedNode("booking_service")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "booking_service" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Layers className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">Booking Service</span>
            </div>

            {/* RabbitMQ Central Broker */}
            <div className="flex flex-col items-center">
              <button 
                id="node-rabbitmq"
                onClick={() => setSelectedNode("rabbitmq")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "rabbitmq" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Radio className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">RabbitMQ Broker</span>
            </div>

            {/* Bottom Row - Relational Databases & Consumers */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-[30px] flex items-center justify-center">
                {/* Visual placeholder to align center properly */}
              </div>
            </div>

            {/* SQL Server Multi tenant */}
            <div className="flex flex-col items-center">
              <button 
                id="node-sql"
                onClick={() => setSelectedNode("sql_server")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "sql_server" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Database className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">SQL Server (DB)</span>
            </div>

            {/* Ticket Service Worker */}
            <div className="flex flex-col items-center">
              <button 
                id="node-ticket-service"
                onClick={() => setSelectedNode("ticket_service")}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  selectedNode === "ticket_service" 
                    ? "bg-cyan-500/10 border-2 border-cyan-500 text-cyan-400 glow-indicator-cyan" 
                    : "bg-black border border-[#27272a] text-gray-400 hover:border-cyan-500 hover:text-white"
                }`}
              >
                <Mail className="w-6 h-6" />
              </button>
              <span className="font-mono text-[11px] mt-2 text-gray-300">Ticket Service</span>
            </div>

          </div>
        </div>

        {/* Floating Trace Info Panel */}
        <div className="mt-4 border-t border-[#27272a] pt-4 flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className={`w-2 h-2 rounded-full ${activeFlow ? 'bg-cyan-400 animate-ping glow-indicator-cyan' : 'bg-emerald-500'}`}></span>
            System Status: Healthy
          </span>
          <span className="text-[#71717a]">Correlation Protocol: W3C Tracecontext</span>
        </div>
      </div>

      {/* Selected Node Details Side-Panel */}
      <div className="bg-[#121217] border border-[#27272a] rounded-lg p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-lg bg-cyan-950/30 text-cyan-400 border border-cyan-900/40`}>
              {nodeObj.type === "gateway" && <Shield className="w-5 h-5" />}
              {nodeObj.type === "service" && <Server className="w-5 h-5" />}
              {nodeObj.type === "actor" && <Cpu className="w-5 h-5" />}
              {nodeObj.type === "broker" && <Radio className="w-5 h-5" />}
              {nodeObj.type === "cache" && <Clock className="w-5 h-5" />}
              {nodeObj.type === "db" && <Database className="w-5 h-5" />}
            </span>
            <div>
              <h4 className="font-mono font-bold text-gray-200">{nodeObj.label}</h4>
              <p className="text-[10px] font-mono text-cyan-400/80 tracking-tight">{nodeObj.techStack}</p>
            </div>
          </div>

          <div className="border-t border-[#27272a] my-3"></div>

          <div>
            <span className="font-mono text-[10px] uppercase text-[#71717a] tracking-wider block mb-1">Architectural Role</span>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">{nodeObj.description}</p>
          </div>

          {nodeObj.endpoints && nodeObj.endpoints.length > 0 && (
            <div>
              <span className="font-mono text-[10px] uppercase text-[#71717a] tracking-wider block mb-1.5">Interfaces & Endpoints</span>
              <div className="space-y-1">
                {nodeObj.endpoints.map((ep, idx) => (
                  <code key={idx} className="block text-[10px] font-mono bg-black text-cyan-400 py-1 px-1.5 rounded border border-[#27272a]">
                    {ep}
                  </code>
                ))}
              </div>
            </div>
          )}

          {nodeObj.metrics && nodeObj.metrics.length > 0 && (
            <div>
              <span className="font-mono text-[10px] uppercase text-[#71717a] tracking-wider block mb-1.5">Live Telemetry Metrics</span>
              <div className="grid grid-cols-2 gap-2">
                {nodeObj.metrics.map((met, idx) => (
                  <div key={idx} className="bg-black border border-[#27272a] rounded p-2 text-center">
                    <span className="text-[10px] text-gray-500 block">{met.label}</span>
                    <span className="text-xs font-mono font-medium text-emerald-400">{met.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-[#27272a] text-center">
          <p className="text-[10.5px] font-mono text-gray-500">
            Node isolated inside private Virtual Network. Zero external exposure except gateway.
          </p>
        </div>
      </div>
    </div>
  );
}
