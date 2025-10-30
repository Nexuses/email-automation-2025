import { NextRequest } from "next/server";
import { listJobs } from "../progress";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const jobs = listJobs();
  // For history, return essential fields only
  const simplified = jobs.map((j) => ({
    jobId: j.jobId,
    status: j.status,
    total: j.total,
    processed: j.processed,
    sent: j.sent,
    errors: j.errors,
    startedAt: j.startedAt,
    updatedAt: j.updatedAt,
    completedAt: j.completedAt,
    batchSize: j.batchSize,
    batchDelayMs: j.batchDelayMs,
    lastTo: j.lastTo,
    lastClientName: j.lastClientName,
    recentEvents: j.recentEvents,
  }));
  return new Response(JSON.stringify({ jobs: simplified }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}



