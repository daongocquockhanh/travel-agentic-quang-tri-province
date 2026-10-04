import { createDataStreamResponse } from "ai";
import { z } from "zod";
import { runAgent } from "@/lib/agent/run";
import { TRACKS } from "@/lib/tracks";

// Node runtime: the local retrieval fallback reads content/sites from disk.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.string(), content: z.string() }).passthrough())
    .min(1)
    .max(100),
  track: z.enum(TRACKS),
  lang: z.enum(["vi", "en"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  site_slug: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/)
    .optional(),
  intent: z.enum(["arrival_story"]).optional(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.safeParse(await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { messages, ...rest } = parsed.data;
  const chatMessages = messages
    .filter((m): m is typeof m & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  if (!chatMessages.some((m) => m.role === "user")) {
    return Response.json({ error: "At least one user message is required" }, { status: 400 });
  }

  return createDataStreamResponse({
    execute: (stream) => runAgent({ ...rest, messages: chatMessages }, stream),
    onError: (error) => {
      console.error("[agent/chat]", error);
      return rest.lang === "vi"
        ? "Hướng dẫn viên đang gặp sự cố. Vui lòng thử lại sau giây lát."
        : "The guide is having trouble right now. Please try again in a moment.";
    },
  });
}
