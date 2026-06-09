/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PhaseFile {
  name: string;
  path: string;
  language: string;
  content: string;
  description: string;
}

export interface PhaseBlueprint {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  bestPractices: string[];
  tradeoffs: string[];
  scalability: string;
  failureScenarios: string;
  files: PhaseFile[];
}

export interface SimulationLog {
  timestamp: string;
  service: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
  traceId: string;
}

export interface SystemMetrics {
  totalRequests: number;
  successfulBookings: number;
  failedBookings: number; // e.g., seat taken
  doubleBookingsPrevented: number;
  avgLatencyMs: number;
  activeOrleansActors: number;
  outboxPending: number;
  outboxPublished: number;
  redisHits: number;
  redisMisses: number;
}

export interface SeatStatus {
  number: string;
  status: "available" | "reserved" | "holding";
  userId: string | null;
}
