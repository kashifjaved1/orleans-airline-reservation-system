/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Network, PlayCircle, Compass
} from "lucide-react";
import { motion } from "motion/react";
import ArchitectureMap from "./components/ArchitectureMap";
import SimulationEngine from "./components/SimulationEngine";
import PassengerTerminal from "./components/PassengerTerminal";

const SHOW_DEV_TABS = true;
const SHOW_AUDIT_TRAIL = true;

export default function App() {
  const [activeTab, setActiveTab] = useState<"architecture" | "passenger_portal" | "simulation">("passenger_portal");

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-300 font-sans grid-bg relative">
      <div className="scanline"></div>

      {/* Dynamic Header Section */}
      <header className="border-b border-[#27272a] bg-[#121217]/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 animate-pulse glow-indicator-cyan"></div>
            <div>
              <h1 className="text-sm font-bold tracking-widest uppercase font-mono text-cyan-400 flex items-center gap-2">
                {SHOW_DEV_TABS ? "Orion Airline Architecture Dashboard" : "Orion Airlines Passenger Portal"}
                <span className="text-[10px] lowercase font-normal text-cyan-400/80 bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded-full font-mono">
                  {SHOW_DEV_TABS ? "v9.0-production" : "Bookings & Ticketing"}
                </span>
              </h1>
              <p className="text-[11px] text-[#71717a] mt-0.5 font-mono">
                {SHOW_DEV_TABS 
                  ? "Distributed Core • Microsoft Orleans • .NET 9.0 • MediatR • CQRS Saga" 
                  : "Instant Seat Allocation & Real-Time Digital Boarding Pass System"}
              </p>
            </div>
          </div>

          {/* Core Navigation Control Tabs & Dynamic Telemetry Stats */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 xl:gap-8">
            {/* Live Telemetry Metadata Block */}
            {SHOW_DEV_TABS && (
              <div className="hidden sm:flex gap-6 text-[10px] font-mono uppercase tracking-tight bg-black/35 py-1.5 px-3 rounded-lg border border-[#27272a]">
                <div className="flex flex-col">
                  <span className="text-[#71717a] text-[9px]">Uptime</span>
                  <span className="text-emerald-400 font-bold">99.998%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#71717a] text-[9px]">Load</span>
                  <span className="text-white font-medium">1,420 r/s</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#71717a] text-[9px]">Active Grains</span>
                  <span className="text-cyan-400 font-medium">12,842</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#71717a] text-[9px]">Silo Mesh</span>
                  <span className="text-emerald-400 font-bold">HEALTHY</span>
                </div>
              </div>
            )}

            {/* Main Tabs Navigation */}
            {SHOW_DEV_TABS && (
              <nav className="flex bg-[#121217] p-1 rounded-lg border border-[#27272a] overflow-x-auto max-w-full">
                <button
                  id="tab-passenger-portal"
                  onClick={() => setActiveTab("passenger_portal")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all tracking-tight shrink-0 ${
                    activeTab === "passenger_portal"
                      ? "bg-cyan-500 text-black font-semibold shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Passenger Terminal
                </button>
                <button
                  id="tab-architecture"
                  onClick={() => setActiveTab("architecture")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all tracking-tight shrink-0 ${
                    activeTab === "architecture"
                      ? "bg-cyan-500 text-black font-semibold shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  Topology Map
                </button>
                <button
                  id="tab-simulation"
                  onClick={() => setActiveTab("simulation")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all tracking-tight shrink-0 ${
                    activeTab === "simulation"
                      ? "bg-cyan-500 text-black font-semibold shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  1000-User Seat Rush
                </button>
              </nav>
            )}
          </div>

        </div>
      </header>

      {/* Main Core Viewport Content Container */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1">
        
        {activeTab === "passenger_portal" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PassengerTerminal showAuditTrail={SHOW_AUDIT_TRAIL} />
          </motion.div>
        )}

        {activeTab === "architecture" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ArchitectureMap />
          </motion.div>
        )}

        {activeTab === "simulation" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SimulationEngine />
          </motion.div>
        )}

      </main>

      {/* Dynamic Cyber Tech styled Footer */}
      <footer className="h-10 border-t border-[#27272a] bg-black flex items-center justify-between px-6 text-[10px] font-mono text-[#71717a]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[#a1a1aa] tracking-widest uppercase">System LOG status: ACTIVE & SECURED</span>
        </div>
        <div className="hidden sm:flex gap-6">
          <span>PROTO: .NET9/ORLEANS</span>
          <span>REGION: US-WEST-2</span>
          <span>V: 1.0.42-STABLE</span>
        </div>
      </footer>

    </div>
  );
}
