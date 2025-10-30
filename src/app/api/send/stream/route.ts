import { NextRequest } from "next/server";
import { getJob, subscribe } from "../progress";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || "";
  if (!jobId || !getJob(jobId)) {
    return new Response("Invalid jobId", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const unsubscribe = subscribe(
        jobId,
        (p) => send("progress", p),
        (p) => {
          send("complete", p);
          controller.close();
        }
      );

      // Cleanup when client disconnects
      // @ts-expect-error - not typed on ReadableStreamDefaultController
      controller.signal?.addEventListener?.("abort", () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}


