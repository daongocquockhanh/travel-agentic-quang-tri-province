import "server-only";
import { formatDataStreamPart, streamText, type DataStreamWriter } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getSite, type Site } from "@/lib/sites";
import {
  MAX_HISTORY_MESSAGES,
  capMessage,
  isPlanningIntent,
  refusalText,
  requiresCuratedGrounding,
} from "@/lib/agent/guards";
import { logContentGap, searchCurated, siteMentionedIn } from "@/lib/agent/retrieval";
import { buildSystemPrompt, type NumberedChunk } from "@/lib/agent/system-prompts";
import { CitationRegistry, buildTools } from "@/lib/agent/tools";
import { nextPlaces } from "@/lib/planner";
import type { AgentAnnotation, AgentRequest, Lang } from "@/lib/agent/types";

/**
 * Main agent entry point. Writes the answer and its citation annotations into
 * `stream`, which the route wraps in a data-stream response for `useChat`.
 *
 * Grounding is enforced here rather than left to the model: for war-track,
 * war/religious sites and sensitive questions we retrieve curated chunks
 * before calling the LLM, refuse (and log a content gap) when there are none,
 * and pin the model to those chunks in the system prompt.
 */
export async function runAgent(req: AgentRequest, stream: DataStreamWriter): Promise<void> {
  const history = req.messages
    .filter((m) => m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: capMessage(m.content) }));
  const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const site = req.site_slug ? await getSite(req.site_slug) : null;
  // The site the question is about: one it names explicitly, else the one in context.
  const mentioned = siteMentionedIn(question);
  const target = mentioned && mentioned !== site?.slug ? await getSite(mentioned) : site;
  const strict =
    requiresCuratedGrounding({ track: req.track, siteType: target?.type, query: question }) ||
    requiresCuratedGrounding({ track: req.track, siteType: site?.type, query: question });

  const registry = new CitationRegistry((ref) =>
    stream.writeMessageAnnotation({ type: "citation", ...ref } satisfies AgentAnnotation),
  );

  let grounding: NumberedChunk[] | null = null;
  if (strict) {
    // Never fall back to other sites' content: an answer about Hiền Lương
    // must not be built from Vĩnh Mốc chunks.
    const chunks = await searchCurated({ query: question, lang: req.lang, site_slug: target?.slug, k: 5 });
    if (!chunks.length) {
      await logContentGap({ query: question, track: req.track, lang: req.lang, site_slug: target?.slug });
      writeMode(stream, { grounded: true, offline: false, refused: true });
      writeText(stream, refusalText(req.lang, siteName(target, req.lang)));
      return;
    }
    grounding = chunks.map((chunk) => ({ ref: registry.register(chunk), chunk }));
  }

  if (!process.env.OPENAI_API_KEY) {
    await answerOffline({ req, question, site: target, grounding, registry, stream });
    return;
  }

  writeMode(stream, { grounded: strict, offline: false, refused: false });

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = streamText({
    model: openai(process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini"),
    system: buildSystemPrompt({
      track: req.track,
      lang: req.lang,
      site: site && { slug: site.slug, name_vi: site.name_vi, name_en: site.name_en, type: site.type },
      location: req.lat != null && req.lng != null ? { lat: req.lat, lng: req.lng } : null,
      groundingChunks: grounding,
    }),
    messages: history,
    tools: buildTools({
      lang: req.lang,
      track: req.track,
      registry,
      site_slug: site?.slug,
      location: req.lat != null && req.lng != null ? { lat: req.lat, lng: req.lng } : null,
    }),
    maxSteps: 4,
    maxTokens: 700,
    temperature: strict ? 0.2 : 0.5,
    // SYSTEM_DESIGN §8.1: one retry with backoff on LLM failure.
    maxRetries: 1,
  });
  result.mergeIntoDataStream(stream);
}

/**
 * No OpenAI key configured: answer extractively from the curated chunks so
 * local dev and demos still show grounded, cited content.
 */
async function answerOffline(args: {
  req: AgentRequest;
  question: string;
  site: Site | null;
  grounding: NumberedChunk[] | null;
  registry: CitationRegistry;
  stream: DataStreamWriter;
}) {
  const { req, question, site, registry, stream } = args;

  // Planning works without an LLM: answer with the recommender's cards,
  // sent as a recommend_next tool result so the UI renders them as usual.
  if (isPlanningIntent(question)) {
    const recommendations = await nextPlaces({
      track: req.track,
      from_slug: site?.slug ?? null,
      from: req.lat != null && req.lng != null ? { lat: req.lat, lng: req.lng } : null,
      k: 3,
    });
    writeMode(stream, { grounded: false, offline: true, refused: false });
    const toolCallId = "offline-recommend";
    stream.write(
      formatDataStreamPart("tool_call", { toolCallId, toolName: "recommend_next", args: { from_slug: site?.slug } }),
    );
    stream.write(formatDataStreamPart("tool_result", { toolCallId, result: { recommendations } }));
    writeText(
      stream,
      req.lang === "vi"
        ? "Chế độ ngoại tuyến — đây là những điểm nên đến tiếp theo cho hành trình của bạn:"
        : "Offline mode — here are good next stops for your track:",
    );
    return;
  }

  let numbered = args.grounding;
  if (!numbered) {
    const chunks = await searchCurated({ query: question, lang: req.lang, site_slug: site?.slug, k: 2 });
    numbered = chunks.map((chunk) => ({ ref: registry.register(chunk), chunk }));
  }

  writeMode(stream, { grounded: Boolean(args.grounding), offline: true, refused: false });

  if (!numbered.length) {
    writeText(
      stream,
      req.lang === "vi"
        ? "Chế độ ngoại tuyến (chưa cấu hình OPENAI_API_KEY): mình chưa tìm thấy nội dung biên soạn nào khớp với câu hỏi này."
        : "Offline mode (OPENAI_API_KEY not set): I couldn't find curated content matching that question.",
    );
    return;
  }

  const intro =
    req.lang === "vi"
      ? "Chế độ ngoại tuyến — trích từ nội dung đã biên soạn:"
      : "Offline mode — excerpts from curated content:";
  const body = numbered
    .slice(0, 2)
    .map(({ ref, chunk }) => `${chunk.body} [${ref}]`)
    .join("\n\n");
  writeText(stream, `${intro}\n\n${body}`);
}

function siteName(site: Site | null, lang: Lang) {
  if (!site) return null;
  return lang === "vi" ? site.name_vi : site.name_en;
}

function writeMode(stream: DataStreamWriter, mode: Omit<Extract<AgentAnnotation, { type: "mode" }>, "type">) {
  stream.writeMessageAnnotation({ type: "mode", ...mode } satisfies AgentAnnotation);
}

function writeText(stream: DataStreamWriter, text: string) {
  stream.write(formatDataStreamPart("text", text));
  stream.write(
    formatDataStreamPart("finish_message", {
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0 },
    }),
  );
}
