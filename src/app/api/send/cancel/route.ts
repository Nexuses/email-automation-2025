import { NextRequest, NextResponse } from "next/server";
import { getJob, requestCancel } from "../progress";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobId = String(body.jobId || "");
    if (!jobId || !getJob(jobId)) {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }
    const state = requestCancel(jobId);
    return NextResponse.json({ ok: true, jobId, status: state?.status, cancelRequested: state?.cancelRequested });
  } catch (e) {
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}



