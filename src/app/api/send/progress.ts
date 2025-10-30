import { EventEmitter } from "events";
import { randomUUID } from "crypto";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type JobProgress = {
  jobId: string;
  status: JobStatus;
  total: number;
  processed: number;
  sent: number;
  errors: number;
  lastTo?: string;
  lastClientName?: string;
  lastStatus?: "sent" | "error";
  errorMessage?: string;
  failures?: { clientName: string; clientEmail: string; error?: string }[];
  // ETA & timing (ISO strings for portability to edge/runtime and client)
  startedAt?: string;
  updatedAt?: string;
  // Server-computed rolling estimate based on observed throughput
  estimatedRemainingMs?: number;
  estimatedCompletionAt?: string;
  // Batch configuration exposed for UI hints
  batchSize?: number;
  batchDelayMs?: number;
  // Cancellation
  cancelRequested?: boolean;
  // Recent activity stream (last N)
  recentEvents?: { timestamp: string; clientName: string; clientEmail: string; status: "accepted" | "error"; error?: string }[];
  completedAt?: string;
};

type JobRecord = {
  emitter: EventEmitter;
  state: JobProgress;
};

const jobs = new Map<string, JobRecord>();
// In-memory store for generated result workbooks per job
const jobResults = new Map<string, Buffer>();
// In-memory job history (store job ids in order of creation)
const jobOrder: string[] = [];

export function createJob(total: number): JobProgress {
  const jobId = randomUUID();
  const record: JobRecord = {
    emitter: new EventEmitter(),
    state: {
      jobId,
      status: "queued",
      total,
      processed: 0,
      sent: 0,
      errors: 0,
      failures: [],
      recentEvents: [],
    },
  };
  jobs.set(jobId, record);
  jobOrder.push(jobId);
  return record.state;
}

export function getJob(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, partial: Partial<JobProgress>): JobProgress | undefined {
  const record = jobs.get(jobId);
  if (!record) return undefined;
  record.state = { ...record.state, ...partial };
  record.emitter.emit("progress", record.state);
  return record.state;
}

export function completeJob(jobId: string, failedOrStatus: boolean | JobStatus = false, errorMessage?: string): JobProgress | undefined {
  const record = jobs.get(jobId);
  if (!record) return undefined;
  const status: JobStatus = typeof failedOrStatus === "string" ? failedOrStatus : (failedOrStatus ? "failed" : "completed");
  record.state = { ...record.state, status, errorMessage, completedAt: new Date().toISOString() };
  record.emitter.emit("complete", record.state);
  return record.state;
}

export function setJobResult(jobId: string, buffer: Buffer) {
  jobResults.set(jobId, buffer);
}

export function getJobResultBuffer(jobId: string): Buffer | undefined {
  return jobResults.get(jobId);
}

export function subscribe(jobId: string, onProgress: (p: JobProgress) => void, onComplete: (p: JobProgress) => void) {
  const record = jobs.get(jobId);
  if (!record) return () => {};
  record.emitter.on("progress", onProgress);
  record.emitter.on("complete", onComplete);
  // Immediately send current state to new subscribers
  onProgress(record.state);
  return () => {
    record.emitter.off("progress", onProgress);
    record.emitter.off("complete", onComplete);
  };
}

export function requestCancel(jobId: string): JobProgress | undefined {
  const record = jobs.get(jobId);
  if (!record) return undefined;
  record.state = { ...record.state, cancelRequested: true, updatedAt: new Date().toISOString() };
  record.emitter.emit("progress", record.state);
  return record.state;
}

export function listJobs(): JobProgress[] {
  // Return shallow copies to avoid accidental mutation by callers
  return jobOrder
    .map((id) => jobs.get(id)?.state)
    .filter((s): s is JobProgress => !!s)
    .slice(-20) // cap to last 20
    .map((s) => ({ ...s, failures: s.failures?.slice(0, 5), recentEvents: s.recentEvents?.slice(-10) }));
}


