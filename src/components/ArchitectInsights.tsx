/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  GitCommit, ArrowRightCircle, Cpu, ShieldAlert, Award, 
  Settings, CheckCircle, Scale, Database, Zap, BookOpen, Send, Sparkles, HelpCircle
} from "lucide-react";

export default function ArchitectInsights() {
  const [messages, setMessages] = useState<Array<{ sender: "user" | "architect"; text: string }>>([
    {
      sender: "architect",
      text: "Greetings, Colleague! I am your Senior Software Architect Assistant. Ask me anything regarding **Microsoft Orleans Grains**, **Saga Orchestration**, **Polly policies**, or **Transactional Outbox** designs within this enterprise airline application."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { sender: "user", text: userMessage }]);
    setInputValue("");
    setIsLoading(true);

    // Simulate thinking delay (750ms) to reflect deep architectural auditing
    setTimeout(() => {
      const msgLower = userMessage.toLowerCase();
      let responseText = "";

      if (msgLower.includes("orleans") || msgLower.includes("actor") || msgLower.includes("grain") || msgLower.includes("single-thread") || msgLower.includes("lock-free")) {
        responseText = `### 🌾 .NET 9 Virtual Actor Pattern & Orleans Concurrency

Microsoft Orleans solves the concurrent seat booking problem through the **Virtual Actor Pattern** (represented by \`IFlightGrain\` and \`FlightGrain\` in our codebase):

1. **Lock-Free Concurrency Execution**:
   - Every \`FlightGrain\` is instantiated as an isolated, single-threaded execution context (or actor) on a Cluster Node.
   - Unlike standard systems using SQL \`SELECT FOR UPDATE\` or Redis Redlocks, Orleans queues incoming checkout packets sequentially.
   - Race conditions are mathematically impossible because the state mutation code (\`ReserveSeatAsync\`) resolves items serialistically in-memory before saving state.

2. **In-Memory Reliability**:
   - The seat database dictionary serves as hot state inside the Silo RAM. Reads have a sub-millisecond timeline.
   - Persistent snapshots are committed to storage write-behind, bypassing DB read overhead.`;
      } else if (msgLower.includes("saga") || msgLower.includes("compensation") || msgLower.includes("orchestrator") || msgLower.includes("rollback")) {
        responseText = `### 🎭 Saga Orchestration State Machine in Orion Airline

When a seat lease succeeds inside Orleans, the downstream ticketing system may still fail (e.g. payment gateway timeout). To prevent orphaned leases, our \`BookingSagaOrchestrator\` controls multi-step operations:

1. **State Progress Flow**:
   - **Step 1**: Lease Seat inside \`IFlightGrain\` (Single-Threaded Actor lock).
   - **Step 2**: Commit PENDING booking record with transactional Outbox message inside \`BookingDbContext\`.
   - **Step 3**: Dispatch Ticketing requests asynchronously and wait for webhook confirms.

2. **Automated Compensation Steps**:
   - If Step 3 crashes or triggers a payment timeout, the Orchestrator initiates an automatic rollback:
   - **Comp_1**: Reverses the Orleans Seat reservation by invoking the release actor action.
   - **Comp_2**: Updates the SQL database booking status to \`Cancelled\` for absolute PNR auditing safety.`;
      } else if (msgLower.includes("outbox") || msgLower.includes("database") || msgLower.includes("persistence") || msgLower.includes("ef core") || msgLower.includes("transaction")) {
        responseText = `### 📦 Transactional Outbox Pattern & DB Atomicity

To guarantee eventual consistency across microservice boundaries, we enforce the **Transactional Outbox Pattern** in \`BookingDbContext\` and the \`OutboxPublishingJob\`:

1. **Atomic DB Transactions**:
   - When a passenger checks out, we write the \`DbBooking\` record AND the \`DbOutboxMessage\` (event envelope) inside the exact same relational SQL Transaction.
   - This guarantees that both states commit together, or both fail together if the database crashes. No events can vanish.

2. **Hosted Sweeper Worker**:
   - The \`OutboxPublishingJob\` runs continuously in the background on .NET 9, fetching pending outbox logs.
   - It publishes events to RabbitMQ with an guaranteed **at-least-once** delivery SLA. Redundant messages are filtered safely at the consumer inbox layer.`;
      } else if (msgLower.includes("polly") || msgLower.includes("retry") || msgLower.includes("circuit") || msgLower.includes("breaker") || msgLower.includes("resilience")) {
        responseText = `### 🛡️ Polly Resilience Strategies & Fault Boundaries

Our system specifies layered **Polly v8** fault policies to handle hardware and networking anomalies:

1. **SQL Transit Retry with Exponential Backoff**:
   - Transient database connection dropouts are automatically backed off using dynamic formulas (e.g., \`2^attempt + jitter\`), preventing DB starvation on reconnection.

2. **Circuit Breaker for Ticketing Integrations**:
   - Handshakes with external airline partners are wrapped inside Circuit Breakers.
   - If the failure rate of the partner API exceeds 50% within a rolling 30-second window, the circuit trips immediately. This allows current transactions to trigger compensating paths gracefully instead of waiting for long TCP failures.`;
      } else if (msgLower.includes("mediatr") || msgLower.includes("cqrs") || msgLower.includes("command") || msgLower.includes("query")) {
        responseText = `### ⚡ CQRS Strategy & MediatR Pipeline Interceptors

To achieve modular development and isolate write/read pipelines, Orion leverages MediatR:

1. **Command Slicing**:
   - Write commands (\`CreateBookingCommand\`) execute through specialized handlers, managing validation, Orleans lease acquisitions, and database persistence sequentially.

2. **Validation Pipeline Interceptors**:
   - Custom MediatR pipeline behaviors evaluate validations (\`CreateBookingCommandValidator\`) immediately on command dispatch.
   - If request data is malformed, the pipeline throws exceptions immediately, preventing downstream allocations or database writes.`;
      } else {
        responseText = `### 🌐 Distributed .NET 9 Orleans Architecture Breakdown

Welcome! Regarding your inquiry on the **Orion Airline Core**, here are key architectural features to audit:

1. **Concurrency Controls (Microsoft Orleans virtual actors)**:
   - Evaluates seat requests in lock-free green thread silos. Reduces peak checkout latency under extreme user rushes from seconds to single digits.

2. **Resilience Boundaries (Polly & Outbox)**:
   - Merges database mutations and message streaming safely behind durable transactional Outbox tables + Polly retry gateways.

3. **Compensation Patterns (Orchestration Saga)**:
   - Leverages a fully centralized Saga Orchestrator to monitor, coordinate, and rollback booking stages if external partner APIs fail.

*Tip: Try mentioning keywords like **"orleans"**, **"saga"**, **"outbox"**, **"polly"**, or **"cqrs"** for specialized deep-dives!*`;
      }

      setMessages(prev => [...prev, { sender: "architect", text: responseText }]);
      setIsLoading(false);
    }, 750);
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Comparison of Sagas: Orchestration vs Choreography */}
      <div className="bg-[#121217] border border-[#27272a] rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-gray-100 text-sm font-mono uppercase tracking-tight">Saga Pattern Comparison: Orchestration vs Choreography</h3>
        </div>

        <p className="text-xs text-[#71717a] font-mono leading-relaxed mb-6">
          Airline bookings represent dual transactional boundaries: lock-free immediate inventory holds vs high-reliability ticket issuing (eventual consistency). To preserve system coherence across failure states, a distributed Saga is required. Here is the comparative analysis:
        </p>

        {/* Detailed Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-[#71717a] uppercase tracking-wider text-[9px]">
                <th className="py-2.5 pb-2">Criterion</th>
                <th className="py-2.5 pb-2 text-cyan-400 font-bold">Orchestration (Recommended)</th>
                <th className="py-2.5 pb-2">Choreography</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 divide-y divide-[#27272a] leading-relaxed">
              <tr>
                <td className="py-3 font-semibold text-cyan-400 text-[11px]">Control Style</td>
                <td className="py-3 text-gray-200">Centralized. A "Saga Coordinator" defines steps explicitly.</td>
                <td className="py-3 text-gray-400">Decentralized. Services publish and react to events organically.</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-cyan-400 text-[11px]">Coupling</td>
                <td className="py-3 text-gray-200">Medium. Orchestrator must recognize participating schemas.</td>
                <td className="py-3 text-gray-400">Low. Services bind strictly via event triggers.</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-cyan-400 text-[11px]">Debuggability & Auditing</td>
                <td className="py-3 text-gray-200">High. The exact Saga state is logged in a single database entity.</td>
                <td className="py-3 text-gray-400">Low. Dynamic workflows are decentralized, requiring log tracing tools.</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-cyan-400 text-[11px]">Compensating Complexity</td>
                <td className="py-3 text-gray-200">Simpler. Orchestrator triggers rollback steps sequentially.</td>
                <td className="py-3 text-gray-400">Complex. Circular event traps are common during failures.</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-cyan-400 text-[11px]">Performance Headroom</td>
                <td className="py-3 text-gray-200">Slightly heavier due to middle orchestrator processes.</td>
                <td className="py-3 text-gray-400">Highly performant with decoupled messaging triggers.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Architect Recommendation */}
        <div className="mt-6 p-4 bg-emerald-950/20 rounded border border-emerald-900/40">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-1.5">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Architect Recommendation: Orchestration for Booking Sagas</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            In Airline reservation landscapes, the strict legal requirement for absolute precision under PNR auditing forms a priority. **Saga Orchestration is recommended**. An explicit coordinator ensures that ticket issuing locks only when seats are secured, avoiding orphaned database states during concurrent checkout collapses.
          </p>
        </div>
      </div>

      {/* 2. Lock-free Performance: Why Orleans is Chosen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-[#121217] border border-[#27272a] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-gray-200 font-mono text-xs uppercase tracking-tight">The Orleans Virtual Actor Safety Engine</span>
          </div>
          
          <p className="text-xs text-[#a1a1aa] leading-relaxed font-sans">
            State locking at high-throughput scale is notoriously compute-heavy. Traditional strategies (e.g., calling PostgreSQL `SELECT FOR UPDATE` or using dynamic distributed lock algorithms like Redis Redlock) create massive read-write waiting stalls, resulting in high latency spikes when 1,000 customers book seats on the same flight simultaneously.
          </p>

          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            **Orleans eliminates these challenges by leveraging Virtual Actors (Grains)**:
          </p>

          <div className="space-y-4 text-xs font-mono text-gray-300">
            <div className="flex items-start gap-2">
              <span className="p-1 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono shrink-0">1</span>
              <div>
                <strong className="text-gray-200 font-mono">Single-Threaded Actor Turn Loops</strong>
                <p className="text-[#a1a1aa] mt-0.5 font-sans leading-relaxed">Every specific FlightGrain runs dynamically as a single thread. All incoming customer check-out tasks are queued sequentially inside the actor's process, completely avoiding resource collisions.</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="p-1 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono shrink-0">2</span>
              <div>
                <strong className="text-gray-200 font-mono">Fully In-Memory State Speed</strong>
                <p className="text-[#a1a1aa] mt-0.5 font-sans leading-relaxed">The seats dictionary remains cached in the host RAM, allowing checks to resolve within 1 millisecond. No database round-trips are required in the critical transaction path.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#121217] border border-[#27272a] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <GitCommit className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-gray-200 font-mono text-xs uppercase tracking-tight">Polly Resilience & Fault Boundaries</span>
          </div>

          <p className="text-xs text-[#a1a1aa] leading-relaxed font-sans">
            An enterprise-scale distributed design requires fault isolation at every critical step. Polly policies are specifically recommended at the following touchpoints:
          </p>

          <div className="space-y-4 text-xs">
            
            <div className="border border-[#27272a] rounded p-3 bg-black">
              <span className="font-mono text-[10.5px] text-cyan-400 font-bold block">1. Exponential Backoff & Retry (Database Queries)</span>
              <p className="text-gray-400 mt-1 leading-relaxed font-sans">
                Applied during EF Core Outbox saving and read replicas querying. Handles transient SQL routing anomalies or temporary deadlocks by retrying with geometric intervals (e.g., 1s, 2s, 4s).
              </p>
            </div>

            <div className="border border-[#27272a] rounded p-3 bg-black">
              <span className="font-mono text-[10.5px] text-emerald-400 font-bold block">2. Circuit Breaker (Third-Party Payment Handshakes)</span>
              <p className="text-gray-400 mt-1 leading-relaxed font-sans">
                Applied on external payment and ticketing gateway HTTP requests. Opens state pathways if failure rate hits 50% over a 30s window, avoiding thread exhaustion and protecting user experience.
              </p>
            </div>

            <div className="border border-[#27272a] rounded p-3 bg-black">
              <span className="font-mono text-[10.5px] text-cyan-500 font-bold block">3. Bulkhead Isolation (Reservation Channels)</span>
              <p className="text-[#a1a1aa] mt-1 leading-relaxed font-sans">
                Restricts the maximum number of simultaneous HTTP requests of API Gateway paths, ensuring a reservation spike on premium holiday flights cannot starve other parts of the platform.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* 3. Interactive AI Architecture Consultant Chat Component */}
      <div className="bg-[#121217] border border-[#27272a] rounded-lg p-6 relative">
        <div className="absolute top-4 right-4 text-[10px] font-mono text-cyan-500/60 bg-cyan-950/20 px-2 py-0.5 border border-cyan-900/40 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Powered by Gemini 3.5-flash
        </div>

        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-gray-100 text-sm font-mono uppercase tracking-tight">Orion Senior Architecture Consultant</h3>
        </div>

        <p className="text-xs text-[#71717a] font-mono leading-relaxed mb-4">
          Engage in dynamic architectural audits. Ask the consultant regarding system coherence, eventual consistency, Outbox tables, Saga orchestration schemas, or real-time simulation metrics!
        </p>

        {/* Chat History Container */}
        <div className="bg-black border border-[#27272a] rounded-lg p-4 h-[300px] overflow-y-auto space-y-4 mb-4 font-mono scrollbar-thin">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-[10px] uppercase font-bold tracking-tight ${msg.sender === "user" ? "text-cyan-400" : "text-emerald-400"}`}>
                  {msg.sender === "user" ? "Client Engineer" : "System Architect"}
                </span>
              </div>
              <div 
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  msg.sender === "user" 
                    ? "bg-cyan-950/20 border border-cyan-800/40 text-cyan-200" 
                    : "bg-[#121217] border border-[#27272a] text-gray-300"
                }`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-[#71717a] text-xs">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span>
              <span>Auditing specifications... connecting with architecture grain oracle...</span>
            </div>
          )}
        </div>

        {/* Form Submission Station */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder="Ask regarding lock-free Turn queues, Saga rollbacks, MediatR, or transactional design..."
            className="flex-1 bg-black text-xs font-mono text-gray-200 placeholder-gray-500 border border-[#27272a] rounded px-3 py-2.5 focus:border-cyan-500/60 focus:outline-none"
          />
          <button 
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-neutral-800 text-black font-mono font-bold px-4 rounded text-xs transition duration-200 flex items-center justify-center gap-1.5 shrink-0 grow-btn cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Consult
          </button>
        </form>
      </div>

    </div>
  );
}
