import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";
import pLimit from "p-limit";
import { createJob, updateJob, completeJob, getJob, setJobResult } from "./progress";

type ParsedRecipient = {
  clientName: string;
  clientEmail: string;
  sisRepName?: string;
  sisRepEmail?: string;
  rowIndex: number; // worksheet row index (0-based; row 0 is header)
};

function normalizeEmail(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  return str;
}

function parseWorkbookToRecipientsWithWriteback(buffer: Buffer): {
  workbook: XLSX.WorkBook;
  worksheet: XLSX.WorkSheet;
  recipients: ParsedRecipient[];
  emailStatusCol: number;
  emailTimestampCol: number;
  emailErrorCol: number;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Read as arrays to track column indices precisely
  const rows = XLSX.utils.sheet_to_json<unknown[][]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const header: string[] = (rows[0] || []).map((h) => String(h || "").trim());
  const ensureColumn = (name: string): number => {
    let idx = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (idx === -1) {
      idx = header.length;
      header.push(name);
      XLSX.utils.sheet_add_aoa(worksheet, [[name]], { origin: { r: 0, c: idx } });
      const range = XLSX.utils.decode_range(worksheet['!ref'] || `A1:${XLSX.utils.encode_cell({ r: 0, c: header.length - 1 })}`);
      range.e.c = Math.max(range.e.c, header.length - 1);
      range.e.r = Math.max(range.e.r, rows.length - 1);
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }
    return idx;
  };

  const colClient = header.findIndex((h) => h.toLowerCase() === 'client');
  const colClientEmail = header.findIndex((h) => h.toLowerCase() === 'clientemailid');
  const colSisRepName = header.findIndex((h) => h.toLowerCase() === 'sisrepresentativename');
  const colSisRepEmail = header.findIndex((h) => h.toLowerCase() === 'sisrepresentativeemail');
  // Ensure modern columns
  const emailStatusCol = ensureColumn('EmailStatus'); // Accepted | Error | Cancelled
  const emailTimestampCol = ensureColumn('EmailTimestamp');
  const emailErrorCol = ensureColumn('EmailError');
  // Legacy support (skip rows previously marked as sent)
  const legacyEmailSentCol = header.findIndex((h) => h.toLowerCase() === 'emailsent');

  const recipients: ParsedRecipient[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const clientName = String((row[colClient] ?? "")).trim();
    const clientEmail = normalizeEmail(row[colClientEmail]);
    const sisRepName = String((row[colSisRepName] ?? "")).trim();
    const sisRepEmail = normalizeEmail(row[colSisRepEmail]);
    if (!clientName || !clientEmail) continue;
    const statusValue = String((row[emailStatusCol] ?? "")).trim().toLowerCase();
    const legacySent = legacyEmailSentCol >= 0 ? String((row[legacyEmailSentCol] ?? "")).trim().toLowerCase() : "";
    const alreadySent = statusValue === 'accepted' || legacySent === 'yes' || legacySent === 'y';
    if (alreadySent) continue;
    recipients.push({ clientName, clientEmail, sisRepName, sisRepEmail, rowIndex: r });
  }

  return { workbook, worksheet, recipients, emailStatusCol, emailTimestampCol, emailErrorCol };
}

function buildHtmlEmail(): string {
  const productList = [
    "Smart Guard – Digitization of security registers and Visitor management.",
    "Smart Cam – AI Powered video analytics; no capex; integrates with existing CCTV.",
    "Smart Patrolling System – Guard tour and patrol management.",
    "Smart Fire Drills – Virtual reality-based fire drill training.",
    "Smart Tracking – Real-time asset tracking.",
    "Smart Aerial Navigation – Drone surveillance.",
    "Smart Parking – Intelligent parking management system.",
  ];

  const items = productList
    .map((t) => `<li style="margin:4px 0">${t}</li>`) 
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.6; color:#222">
    <p>Dear Sir/Madam,</p>
    <p>Greetings!</p>
    <p>We hope this message finds you well.</p>
    <p>
      First and foremost, we would like to sincerely thank you for participating in
      our recent survey regarding SIS’s newly launched suite of software solutions aimed at
      enhancing the productivity and effectiveness of security manpower and electronic
      security infrastructure.
    </p>
    <p>Our suite includes:</p>
    <ul>${items}</ul>
    <p>
      We appreciate your interest in exploring our SaaS solutions further. To assist you better,
      we have attached a brief presentation outlining each product.
    </p>
    <p>
      Kindly let us know which specific solution(s) you are most interested in. This will allow us
      to schedule a focused and detailed discussion tailored to your needs.
    </p>
    <p>Looking forward to your response.</p>
    <p>Regards,<br/>SIS Tech</p>
  </div>`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();

    const excelFile = formData.get("excel") as File | null;
    const pdfFile = formData.get("pdf") as File | null;
    const senderEmail = String(formData.get("from") || "shreya.s@sisindia.co").trim();
    const dryRun = String(formData.get("dryRun") || "false").toLowerCase() === "true";
    const subject =
      String(
        formData.get("subject") ||
          "Thank You for Participating in Our Survey – Next Steps on SaaS Solutions (Software as a Service)"
      ).trim();
    

    if (!excelFile) {
      return NextResponse.json({ error: "Missing 'excel' file field" }, { status: 400 });
    }
    if (!pdfFile) {
      return NextResponse.json({ error: "Missing 'pdf' file field" }, { status: 400 });
    }

    // Sender email defaults to shreya.s@sisindia.co if not provided

    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    const { workbook, worksheet, recipients, emailStatusCol, emailTimestampCol, emailErrorCol } =
      parseWorkbookToRecipientsWithWriteback(excelBuffer);
    if (!recipients.length) {
      return NextResponse.json({ error: "No valid recipients found in Excel" }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    if (!dryRun && (!smtpHost || !smtpUser || !smtpPass)) {
      return NextResponse.json({ error: "SMTP environment variables not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });
    
    // Default CC recipients added alongside the representative's CC per email
    const defaultCcAddresses: string[] = [
      "mahesh.kotgire@sisindia.com",
      "jsudip@sisindia.com",
    ];
    
    // Batching configuration
    const defaultBatchSize = 1;
    const defaultBatchDelayMinutes = 5; // 5 minutes
    const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || defaultBatchSize));
    const batchDelayMinutes = Math.max(0, Number(process.env.BATCH_DELAY_MINUTES || defaultBatchDelayMinutes));
    const batchDelayMs = batchDelayMinutes * 60 * 1000;

    const limit = pLimit(5);

    async function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function formatIST(now = new Date()): string {
      return now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
    }

    async function sendOne(r: ParsedRecipient) {
      const to = r.clientEmail;
      // CC should be derived per-row from the sheet's SisRepresentativeEmail
      const cc: string[] = [];
      if (r.sisRepEmail) cc.push(r.sisRepEmail);
      // Also include the default CC addresses
      cc.push(...defaultCcAddresses);

      // Deduplicate while preserving order
      const seen = new Set<string>();
      const dedupedCc = cc.filter((addr) => {
        const key = addr.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const html = buildHtmlEmail();

      const mailOptions = {
        from: senderEmail,
        to,
        cc: dedupedCc.length ? dedupedCc : undefined,
        subject,
        html,
        attachments: [
          {
            filename: "SIS_SaaS_Solutions.pdf",
            content: pdfBuffer,
          },
        ],
      } as nodemailer.SendMailOptions;

      if (dryRun) {
        return { to, cc: dedupedCc.length ? dedupedCc : undefined, subject, html, status: "skipped" as const };
      }

      await transporter.sendMail(mailOptions);
      // Write back EmailStatus and EmailTimestamp to the worksheet for this row
      const ts = formatIST();
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [["Accepted", ts, ""]],
        { origin: { r: r.rowIndex, c: Math.min(emailStatusCol, emailTimestampCol, emailErrorCol) } }
      );
      // If columns are not adjacent, set individually to be safe
      if (emailTimestampCol !== emailStatusCol + 1 || emailErrorCol !== emailStatusCol + 2) {
        XLSX.utils.sheet_add_aoa(worksheet, [["Accepted"]], { origin: { r: r.rowIndex, c: emailStatusCol } });
        XLSX.utils.sheet_add_aoa(worksheet, [[ts]], { origin: { r: r.rowIndex, c: emailTimestampCol } });
        XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: { r: r.rowIndex, c: emailErrorCol } });
      }
      return { to, cc: dedupedCc.length ? dedupedCc : undefined, subject, status: "accepted" as const };
    }

    // Create an async job for progress streaming
    const job = createJob(recipients.length);
    const jobId = job.jobId;

    // Kick off async processing without awaiting
    (async () => {
      try {
        const startedAt = new Date();
        const totalBatches = Math.ceil(recipients.length / Math.max(1, batchSize));
        const initialWaitsRemaining = Math.max(0, totalBatches - 1);
        updateJob(jobId, {
          status: "running",
          startedAt: startedAt.toISOString(),
          updatedAt: startedAt.toISOString(),
          batchSize,
          batchDelayMs,
          estimatedRemainingMs: initialWaitsRemaining * batchDelayMs,
          estimatedCompletionAt: new Date(startedAt.getTime() + initialWaitsRemaining * batchDelayMs).toISOString(),
        });
        let processed = 0;
        let sent = 0;
        let errors = 0;

        for (let i = 0; i < recipients.length; i += batchSize) {
          if (getJob(jobId)?.state.cancelRequested) {
            // Mark remaining rows as Cancelled for clarity
            try {
              for (let rr = i; rr < recipients.length; rr++) {
                const rowIdx = recipients[rr].rowIndex;
                const ts = formatIST();
                XLSX.utils.sheet_add_aoa(worksheet, [["Cancelled"]], { origin: { r: rowIdx, c: emailStatusCol } });
                XLSX.utils.sheet_add_aoa(worksheet, [[ts]], { origin: { r: rowIdx, c: emailTimestampCol } });
              }
            } catch {}
            // persist workbook and mark as cancelled
            try {
              const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
              setJobResult(jobId, outBuffer);
            } catch {}
            completeJob(jobId, "cancelled");
            return;
          }
          const batch = recipients.slice(i, i + batchSize);
          // process sequentially inside batch to update UI per recipient
          for (const r of batch) {
            if (getJob(jobId)?.state.cancelRequested) {
              try {
                // Mark this and the remaining rows as Cancelled
                const ts = formatIST();
                XLSX.utils.sheet_add_aoa(worksheet, [["Cancelled"]], { origin: { r: r.rowIndex, c: emailStatusCol } });
                XLSX.utils.sheet_add_aoa(worksheet, [[ts]], { origin: { r: r.rowIndex, c: emailTimestampCol } });
                const start = i + Math.max(1, batchSize); // next batch start
                for (let rr = start; rr < recipients.length; rr++) {
                  const rowIdx = recipients[rr].rowIndex;
                  XLSX.utils.sheet_add_aoa(worksheet, [["Cancelled"]], { origin: { r: rowIdx, c: emailStatusCol } });
                  XLSX.utils.sheet_add_aoa(worksheet, [[ts]], { origin: { r: rowIdx, c: emailTimestampCol } });
                }
              } catch {}
              try {
                const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
                setJobResult(jobId, outBuffer);
              } catch {}
              completeJob(jobId, "cancelled");
              return;
            }
            try {
              const res = await limit(() => sendOne(r));
              processed += 1;
              if (res.status === "accepted") sent += 1; else errors += 0;
              const now = new Date();
              const completedBatches = Math.floor(processed / Math.max(1, batchSize));
              const waitsRemaining = Math.max(0, totalBatches - completedBatches - 1);
              const remainingMs = waitsRemaining * batchDelayMs;
              const prev = getJob(jobId)?.state.recentEvents || [];
              const recentEvents = [...prev, { timestamp: now.toISOString(), clientName: r.clientName, clientEmail: r.clientEmail, status: "accepted" as const }].slice(-10);
              updateJob(jobId, {
                processed,
                sent,
                errors,
                lastTo: res.to,
                lastClientName: r.clientName,
                lastStatus: res.status === "accepted" ? "sent" : "error",
                recentEvents,
                updatedAt: now.toISOString(),
                estimatedRemainingMs: remainingMs,
                estimatedCompletionAt: new Date(now.getTime() + remainingMs).toISOString(),
              });
            } catch (e) {
              processed += 1;
              errors += 1;
              const now = new Date();
              const completedBatches = Math.floor(processed / Math.max(1, batchSize));
              const waitsRemaining = Math.max(0, totalBatches - completedBatches - 1);
              const remainingMs = waitsRemaining * batchDelayMs;
              const errorMessage = e instanceof Error ? e.message : "Send error";
              // Write back error state in workbook
              try {
                const ts = formatIST();
                XLSX.utils.sheet_add_aoa(worksheet, [["Error"]], { origin: { r: r.rowIndex, c: emailStatusCol } });
                XLSX.utils.sheet_add_aoa(worksheet, [[ts]], { origin: { r: r.rowIndex, c: emailTimestampCol } });
                XLSX.utils.sheet_add_aoa(worksheet, [[errorMessage]], { origin: { r: r.rowIndex, c: emailErrorCol } });
              } catch {}
              const prev = getJob(jobId)?.state.recentEvents || [];
              const recentEvents = [...prev, { timestamp: now.toISOString(), clientName: r.clientName, clientEmail: r.clientEmail, status: "error" as const, error: errorMessage }].slice(-10);
              updateJob(jobId, {
                processed,
                sent,
                errors,
                lastTo: r.clientEmail,
                lastClientName: r.clientName,
                lastStatus: "error",
                errorMessage,
                failures: [
                  ...(getJob(jobId)?.state.failures || []),
                  {
                    clientName: r.clientName,
                    clientEmail: r.clientEmail,
                    error: errorMessage,
                  },
                ],
                recentEvents,
                updatedAt: now.toISOString(),
                estimatedRemainingMs: remainingMs,
                estimatedCompletionAt: new Date(now.getTime() + remainingMs).toISOString(),
              });
            }
          }
          const isLastBatch = i + batchSize >= recipients.length;
          if (!isLastBatch && !dryRun && batchDelayMs > 0) {
            await sleep(batchDelayMs);
          }
        }
        // After processing, persist the updated workbook into memory for download
        try {
          const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
          setJobResult(jobId, outBuffer);
        } catch {}
        completeJob(jobId, false);
      } catch (e) {
        completeJob(jobId, true, e instanceof Error ? e.message : "Unknown error");
      }
    })();

    return NextResponse.json({ jobId, total: recipients.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


