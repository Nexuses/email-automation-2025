"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Row = {
  Client?: string;
  ClientEmailId?: string;
  SisRepresentativeName?: string;
  SisRepresentativeEmail?: string;
};

type PreviewRow = {
  clientName: string;
  clientEmail: string;
  sisRepEmail?: string;
};

type RecentEvent = { timestamp: string; clientName: string; clientEmail: string; status: string; error?: string };
type HistoryItem = {
  jobId: string;
  status: string;
  total: number;
  processed: number;
  sent: number;
  errors: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  batchSize?: number;
  batchDelayMs?: number;
  lastTo?: string;
  lastClientName?: string;
  recentEvents?: RecentEvent[];
};

function parseExcelForPreview(file: File): Promise<PreviewRow[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
      const mapped: PreviewRow[] = rows
        .map((r) => ({
          clientName: String(r.Client || "").trim(),
          clientEmail: String(r.ClientEmailId || "").trim(),
          sisRepEmail: String(r.SisRepresentativeEmail || "").trim() || undefined,
        }))
        .filter((r) => r.clientName && r.clientEmail);
      resolve(mapped);
    } catch (e) {
      reject(e);
    }
  });
}

export default function UploadForm() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fromEmail, setFromEmail] = useState<string>("sourav.c@sisindia-tech.com");
  const [subject, setSubject] = useState<string>(
    "Thank You for Participating in Our Survey – Next Steps on SaaS Solutions (Software as a Service)"
  );
  
  // dryRun removed; always send real emails
  const [busy, setBusy] = useState<boolean>(false);
  const [dragExcel, setDragExcel] = useState<boolean>(false);
  const [dragPdf, setDragPdf] = useState<boolean>(false);
  type ApiResponse =
    | { error: string }
    | { jobId: string; total: number };
  
  const [progress, setProgress] = useState<{
    processed: number;
    sent: number;
    errors: number;
    total: number;
    lastTo?: string;
    lastClientName?: string;
    status?: string;
    failures?: { clientName: string; clientEmail: string; error?: string }[];
    // ETA fields from server (optional)
    startedAt?: string;
    updatedAt?: string;
    estimatedRemainingMs?: number;
    estimatedCompletionAt?: string;
    batchSize?: number;
    batchDelayMs?: number;
  } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [recent, setRecent] = useState<RecentEvent[] | null>(null);

  const isRunning = useMemo(() => {
    if (!progress) return false;
    const isDone =
      progress.processed >= progress.total ||
      progress.status === "completed" ||
      progress.status === "failed";
    return !isDone;
  }, [progress]);

  const previewRows = useMemo<PreviewRow[]>(() => [], []);
  const [preview, setPreview] = useState<PreviewRow[]>(previewRows);

  async function handleExcelChange(file: File | null) {
    setExcelFile(file);
    setPreview([]);
    if (file) {
      try {
        const rows = await parseExcelForPreview(file);
        setPreview(rows.slice(0, 50));
      } catch {
        setError("Failed to parse Excel");
      }
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!excelFile || !pdfFile || !fromEmail) {
      setError("Please provide Excel, PDF and From email");
      toast.error("Please provide Excel, PDF and From email");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("excel", excelFile);
      form.append("pdf", pdfFile);
      form.append("from", fromEmail);
      form.append("subject", subject);
      // dryRun omitted; server will send emails
      const res = await fetch("/api/send", { method: "POST", body: form });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) {
        const message = (json as { error?: string })?.error || "Request failed";
        setError(message);
        toast.error(message);
      } else {
        if ("jobId" in json) {
          setProgress({ processed: 0, sent: 0, errors: 0, total: json.total });
          setCurrentJobId(json.jobId);
          // Start listening to progress stream
          const es = new EventSource(`/api/send/stream?jobId=${json.jobId}`);
          es.addEventListener("progress", (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data);
              setProgress({
                processed: data.processed,
                sent: data.sent,
                errors: data.errors,
                total: data.total,
                lastTo: data.lastTo,
                lastClientName: data.lastClientName,
                status: data.status,
                failures: data.failures,
                startedAt: data.startedAt,
                updatedAt: data.updatedAt,
                estimatedRemainingMs: data.estimatedRemainingMs,
                estimatedCompletionAt: data.estimatedCompletionAt,
                batchSize: data.batchSize,
                batchDelayMs: data.batchDelayMs,
              });
              if (Array.isArray(data.recentEvents)) setRecent(data.recentEvents);
            } catch {}
          });
          es.addEventListener("complete", (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data);
              setProgress({
                processed: data.processed,
                sent: data.sent,
                errors: data.errors,
                total: data.total,
                lastTo: data.lastTo,
                lastClientName: data.lastClientName,
                status: data.status,
                failures: data.failures,
                startedAt: data.startedAt,
                updatedAt: data.updatedAt,
                estimatedRemainingMs: data.estimatedRemainingMs,
                estimatedCompletionAt: data.estimatedCompletionAt,
                batchSize: data.batchSize,
                batchDelayMs: data.batchDelayMs,
              });
              if (Array.isArray(data.recentEvents)) setRecent(data.recentEvents);
            } catch {}
            es.close();
            toast.success("Campaign processing completed");
          });
        } else {
          toast.success("Campaign queued successfully");
        }
      }
    } catch {
      setError("Network error");
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  // Tick "now" every second while a campaign is running to update countdown smoothly
  useEffect(() => {
    if (!progress) return;
    const isDone = progress.processed >= progress.total || progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled";
    if (isDone) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [progress]);

  function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  const remainingMs = useMemo(() => {
    if (!progress?.estimatedCompletionAt) return undefined;
    const etaMs = new Date(progress.estimatedCompletionAt).getTime();
    return Math.max(0, etaMs - nowMs);
  }, [progress?.estimatedCompletionAt, nowMs]);

  async function handleCancel() {
    if (!currentJobId) return;
    try {
      const res = await fetch("/api/send/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: currentJobId }) });
      if (!res.ok) throw new Error("Cancel failed");
      toast.message("Cancellation requested. Preparing current Excel...");
    } catch {
      toast.error("Failed to cancel");
    }
  }

  async function refreshHistory() {
    try {
      const res = await fetch("/api/send/history", { cache: "no-store" });
      const json = await res.json();
      setHistory(json.jobs || []);
    } catch {}
  }

  useEffect(() => {
    refreshHistory();
    const id = setInterval(refreshHistory, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="grid gap-6">
        <div className="grid gap-6 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft">
          <div className="grid sm:grid-cols-2 gap-4" id="upload">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Excel file</label>
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragExcel(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragExcel(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragExcel(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragExcel(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && /(xlsx|xls)$/i.test(file.name)) {
                    handleExcelChange(file);
                  } else if (file) {
                    setError("Please drop a valid .xlsx or .xls file");
                  }
                }}
                className={`relative grid place-items-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${dragExcel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              >
                <div className="text-xs text-muted-foreground">
                  {excelFile ? (
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="truncate">{excelFile.name}</span>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => { setExcelFile(null); setPreview([]); }}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 text-foreground">Drag & drop Excel (.xlsx) or click to browse</div>
                      <div className="text-[11px]">Max 50 rows previewed</div>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleExcelChange(e.target.files?.[0] || null)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">PDF attachment</label>
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragPdf(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragPdf(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragPdf(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragPdf(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && /pdf$/i.test(file.name)) {
                    setPdfFile(file);
                  } else if (file) {
                    setError("Please drop a valid .pdf file");
                  }
                }}
                className={`relative grid place-items-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${dragPdf ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              >
                <div className="text-xs text-muted-foreground">
                  {pdfFile ? (
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="truncate">{pdfFile.name}</span>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setPdfFile(null)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 text-foreground">Drag & drop PDF or click to browse</div>
                      <div className="text-[11px]">This PDF will be attached to all emails</div>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={busy}
                />
              </div>
            </div>
          </div>

        <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">From email</label>
              <input
                type="email"
                placeholder="sourav.c@sisindia-tech.com"
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">Used as the sender (From)</p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Subject</label>
              <input
                type="text"
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Emails send in batches (1 email every 5 minutes)
            </div>

            <button
              id="send"
              disabled={busy || isRunning}
              onClick={handleSubmit}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isRunning ? "Campaign running..." : busy ? "Sending..." : "Send campaign"}
            </button>
            {isRunning && currentJobId && (
              <button
                id="cancel"
                onClick={handleCancel}
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/70"
              >
                Cancel & export current Excel
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200/30 bg-red-50/60 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {preview.length > 0 && (
          <div id="preview" className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Preview of first {preview.length} recipients</div>
              <div className="text-xs text-muted-foreground">Only the first 50 rows are shown</div>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr className="text-left text-foreground">
                    <th className="p-2 font-medium">Client</th>
                    <th className="p-2 font-medium">Email</th>
                    <th className="p-2 font-medium">SIS Rep CC</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="p-2 whitespace-nowrap">{r.clientName}</td>
                      <td className="p-2 whitespace-nowrap">{r.clientEmail}</td>
                      <td className="p-2 whitespace-nowrap">{r.sisRepEmail || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {progress && (
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Sending progress</div>
              <div className="text-xs text-muted-foreground">{progress.processed} / {progress.total} processed</div>
            </div>
            <div className="h-2 w-full rounded bg-muted">
              <div
                className="h-2 rounded bg-primary transition-[width]"
                style={{ width: `${Math.min(100, Math.round((progress.processed / Math.max(1, progress.total)) * 100))}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">Sent: {progress.sent}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">Errors: {progress.errors}</span>
              {progress.lastTo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">Last: {progress.lastClientName ? `${progress.lastClientName} <${progress.lastTo}>` : progress.lastTo}</span>
              )}
              {typeof remainingMs === "number" && progress.processed < progress.total && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                  ETA: {formatDuration(remainingMs)}
                </span>
              )}
              {progress.estimatedCompletionAt && progress.processed < progress.total && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                  Finishes ~ {new Date(progress.estimatedCompletionAt).toLocaleString()}
                </span>
              )}
            </div>
            {progress.failures && progress.failures.length > 0 && (
              <div className="rounded-md border border-red-200/30 bg-red-50/60 p-3 text-xs text-red-700 dark:text-red-300">
                <div className="font-semibold mb-2">Failed recipients</div>
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className="p-1">Client</th>
                        <th className="p-1">Email</th>
                        <th className="p-1">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.failures.map((f, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          <td className="p-1 whitespace-nowrap">{f.clientName}</td>
                          <td className="p-1 whitespace-nowrap">{f.clientEmail}</td>
                          <td className="p-1 whitespace-pre-wrap break-words">{f.error || "Unknown error"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {currentJobId && (progress.processed === progress.total || progress.status === "cancelled") && (
              <div className="flex items-center justify-end">
                <a
                  href={`/api/send/result?jobId=${currentJobId}`}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                >
                  {progress.status === "cancelled" ? "Download partial Excel" : "Download updated Excel"}
                </a>
              </div>
            )}
          </div>
        )}

        {recent && recent.length > 0 && (
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Recent activity</div>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr className="text-left text-foreground">
                    <th className="p-2 font-medium">Time</th>
                    <th className="p-2 font-medium">Client</th>
                    <th className="p-2 font-medium">Email</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((ev, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="p-2 whitespace-nowrap">{new Date(ev.timestamp).toLocaleString()}</td>
                      <td className="p-2 whitespace-nowrap">{ev.clientName}</td>
                      <td className="p-2 whitespace-nowrap">{ev.clientEmail}</td>
                      <td className="p-2 whitespace-nowrap">{ev.status}</td>
                      <td className="p-2 whitespace-pre-wrap break-words">{ev.error || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {history && (
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Job history</div>
              <button className="text-xs underline" onClick={refreshHistory}>Refresh</button>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr className="text-left text-foreground">
                    <th className="p-2 font-medium">Job</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Progress</th>
                    <th className="p-2 font-medium">Sent</th>
                    <th className="p-2 font-medium">Errors</th>
                    <th className="p-2 font-medium">Started</th>
                    <th className="p-2 font-medium">Updated</th>
                    <th className="p-2 font-medium">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((j, i) => (
                    <tr key={j.jobId} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="p-2 whitespace-nowrap">{j.jobId.slice(0, 8)}…</td>
                      <td className="p-2 whitespace-nowrap">{j.status}</td>
                      <td className="p-2 whitespace-nowrap">{j.processed} / {j.total}</td>
                      <td className="p-2 whitespace-nowrap">{j.sent}</td>
                      <td className="p-2 whitespace-nowrap">{j.errors}</td>
                      <td className="p-2 whitespace-nowrap">{j.startedAt ? new Date(j.startedAt).toLocaleString() : "-"}</td>
                      <td className="p-2 whitespace-nowrap">{j.updatedAt ? new Date(j.updatedAt).toLocaleString() : "-"}</td>
                      <td className="p-2 whitespace-nowrap">
                        <a className="underline" href={`/api/send/result?jobId=${j.jobId}`}>Excel</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


