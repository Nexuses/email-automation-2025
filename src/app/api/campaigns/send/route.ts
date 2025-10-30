import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import pLimit from "p-limit";
import { CampaignService, ProspectService } from '@/lib/services';
import { createJob, updateJob, completeJob, getJob, setJobResult } from "../../send/progress";

type CampaignRecipient = {
  firstName: string;
  lastName?: string;
  clientEmail: string;
  companyName?: string;
};

function buildHtmlEmail(pitch: string, r: CampaignRecipient, campaignId: string): string {
  // Simple variable substitution for personalization
  const map: Record<string, string> = {
    firstName: r.firstName || "",
    lastName: r.lastName || "",
    companyName: r.companyName || "",
  };
  let out = pitch || "";
  
  // Replace personalization variables
  out = out.replace(/\{\{\s*firstName\s*\}\}/gi, map.firstName);
  out = out.replace(/\{\{\s*lastName\s*\}\}/gi, map.lastName);
  out = out.replace(/\{\{\s*companyName\s*\}\}/gi, map.companyName);
  
  // Check if content is already HTML (from rich text editor)
  if (out.includes('<') && out.includes('>')) {
    // Content is already HTML, just clean it up for email compatibility
    out = out
      .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/class="[^"]*"/gi, '') // Remove classes
      .replace(/<font[^>]*>/gi, '') // Remove font tags
      .replace(/<\/font>/gi, '')
      .replace(/<span[^>]*>/gi, '') // Remove span tags
      .replace(/<\/span>/gi, '');
    
    // Ensure proper email styling
    out = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${out}</div>`;
  } else {
    // Content is plain text, apply enhanced formatting
    // First, normalize line endings
    out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split into lines for processing
    const lines = out.split('\n');
    const processedLines: string[] = [];
    let inBulletList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines but preserve paragraph breaks
      if (line === '') {
        if (inBulletList) {
          processedLines.push('</ul>');
          inBulletList = false;
        }
        processedLines.push('<br>');
        continue;
      }

      // Check for bullet points (•, -, *, +, etc.)
      const bulletMatch = line.match(/^[\s]*[•\-\*\+]\s+(.+)$/);
      if (bulletMatch) {
        if (!inBulletList) {
          processedLines.push('<ul style="margin: 8px 0; padding-left: 20px;">');
          inBulletList = true;
        }
        processedLines.push(`<li style="margin: 4px 0;">${bulletMatch[1]}</li>`);
      } else {
        // Regular text line
        if (inBulletList) {
          processedLines.push('</ul>');
          inBulletList = false;
        }
        processedLines.push(`<p style="margin: 8px 0;">${line}</p>`);
      }
    }

    // Close any open bullet list
    if (inBulletList) {
      processedLines.push('</ul>');
    }
    
    // Join all processed lines
    out = processedLines.join('');
    
    // Wrap in a container div for better email formatting
    out = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${out}</div>`;
  }

  // Add tracking pixel for open tracking
  const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/track/${campaignId}?email=${encodeURIComponent(r.clientEmail)}&action=open" width="1" height="1" style="display:none;" />`;
  
  // Add tracking to all links for click tracking
  out = out.replace(/<a\s+([^>]*?)href="([^"]*?)"([^>]*?)>/gi, (match, before, url, after) => {
    const trackedUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/track/${campaignId}?email=${encodeURIComponent(r.clientEmail)}&action=click&redirect=${encodeURIComponent(url)}`;
    return `<a ${before}href="${trackedUrl}"${after}>`;
  });

  return out + trackingPixel;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { campaignId, pdfFile } = body;

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
    }

    // Get campaign details
    const campaign = await CampaignService.getCampaignById(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json({ error: "Campaign is not in draft status" }, { status: 400 });
    }

    // Get prospects from the segment
    const prospects = await ProspectService.getProspectsBySegment(campaign.segmentId);
    if (!prospects.length) {
      return NextResponse.json({ error: "No prospects found in segment" }, { status: 400 });
    }

    // Convert prospects to recipients
    const recipients: CampaignRecipient[] = prospects.map(prospect => ({
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      clientEmail: prospect.clientEmail,
      companyName: prospect.companyName,
    }));

    // SMTP configuration
    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: "SMTP environment variables not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // Batching configuration
    const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || 1));
    const batchDelayMinutes = Math.max(0, Number(process.env.BATCH_DELAY_MINUTES || 5));
    const batchDelayMs = batchDelayMinutes * 60 * 1000;

    const limit = pLimit(5);

    async function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function formatIST(now = new Date()): string {
      return now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
    }

    async function sendOne(r: CampaignRecipient) {
      const to = r.clientEmail;
      // No CC recipients
      const cc: string[] = [];

      const html = buildHtmlEmail(campaign.pitch, r, campaignId);

      const mailOptions = {
        from: campaign.senderEmail,
        to,
        cc: undefined,
        subject: campaign.subject,
        html: html,
        text: html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
        attachments: pdfFile ? [
          {
            filename: "attachment.pdf",
            content: Buffer.from(pdfFile, 'base64'),
          },
        ] : undefined,
      } as nodemailer.SendMailOptions;

      await transporter.sendMail(mailOptions);
      
      // Create tracking record for this email
      await EmailTrackingService.createTrackingRecord(campaignId, r.clientEmail);
      
      return { to, cc: undefined, subject: campaign.subject, status: "accepted" as const };
    }

    // Update campaign status to running
    await CampaignService.updateCampaignStatus(campaignId, 'running');

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
            await CampaignService.updateCampaignStatus(campaignId, 'cancelled');
            completeJob(jobId, "cancelled");
            return;
          }

          const batch = recipients.slice(i, i + batchSize);
          
          for (const r of batch) {
            if (getJob(jobId)?.state.cancelRequested) {
              await CampaignService.updateCampaignStatus(campaignId, 'cancelled');
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
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ');
              const recentEvents = [...prev, { 
                timestamp: now.toISOString(), 
                clientName: fullName || r.firstName, 
                clientEmail: r.clientEmail, 
                status: "accepted" as const 
              }].slice(-10);

              updateJob(jobId, {
                processed,
                sent,
                errors,
                lastTo: res.to,
                lastClientName: fullName || r.firstName,
                lastStatus: res.status === "accepted" ? "sent" : "error",
                recentEvents,
                updatedAt: now.toISOString(),
                estimatedRemainingMs: remainingMs,
                estimatedCompletionAt: new Date(now.getTime() + remainingMs).toISOString(),
              });

              // Update campaign progress
              await CampaignService.updateCampaignStatus(campaignId, 'running', {
                sentEmails: sent,
                failedEmails: errors,
              });

            } catch (e) {
              processed += 1;
              errors += 1;
              const now = new Date();
              const completedBatches = Math.floor(processed / Math.max(1, batchSize));
              const waitsRemaining = Math.max(0, totalBatches - completedBatches - 1);
              const remainingMs = waitsRemaining * batchDelayMs;
              const errorMessage = e instanceof Error ? e.message : "Send error";
              
              const prev = getJob(jobId)?.state.recentEvents || [];
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ');
              const recentEvents = [...prev, { 
                timestamp: now.toISOString(), 
                clientName: fullName || r.firstName, 
                clientEmail: r.clientEmail, 
                status: "error" as const, 
                error: errorMessage 
              }].slice(-10);

              updateJob(jobId, {
                processed,
                sent,
                errors,
                lastTo: r.clientEmail,
                lastClientName: fullName || r.firstName,
                lastStatus: "error",
                errorMessage,
                failures: [
                  ...(getJob(jobId)?.state.failures || []),
                  {
                    clientName: fullName || r.firstName,
                    clientEmail: r.clientEmail,
                    error: errorMessage,
                  },
                ],
                recentEvents,
                updatedAt: now.toISOString(),
                estimatedRemainingMs: remainingMs,
                estimatedCompletionAt: new Date(now.getTime() + remainingMs).toISOString(),
              });

              // Update campaign progress
              await CampaignService.updateCampaignStatus(campaignId, 'running', {
                sentEmails: sent,
                failedEmails: errors,
              });
            }
          }

          const isLastBatch = i + batchSize >= recipients.length;
          if (!isLastBatch && batchDelayMs > 0) {
            await sleep(batchDelayMs);
          }
        }

        // Mark campaign as completed
        await CampaignService.updateCampaignStatus(campaignId, 'completed', {
          sentEmails: sent,
          failedEmails: errors,
        });

        completeJob(jobId, false);
      } catch (e) {
        await CampaignService.updateCampaignStatus(campaignId, 'failed');
        completeJob(jobId, true, e instanceof Error ? e.message : "Unknown error");
      }
    })();

    return NextResponse.json({ jobId, total: recipients.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
