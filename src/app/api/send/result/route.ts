import { NextRequest } from "next/server";
import { getJob, getJobResultBuffer } from "../progress";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || "";
  if (!jobId || !getJob(jobId)) {
    return new Response("Invalid jobId", { status: 400 });
  }

  const buffer = getJobResultBuffer(jobId);
  if (!buffer) {
    return new Response("Result not ready", { status: 409 });
  }

  // Convert Node Buffer to Uint8Array which satisfies BodyInit (BufferSource)
  const body = new Uint8Array(buffer);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="updated-${jobId}.xlsx"`,
      "Cache-Control": "no-cache",
    },
  });
}


