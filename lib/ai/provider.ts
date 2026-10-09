// No "server-only" here: scripts/ingest.ts imports this outside a Next build.
import { generateText, type EmbeddingModel, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";

/**
 * Which LLM vendor serves chat, embeddings and speech-to-text.
 *
 * AI_PROVIDER=google|openai picks one explicitly; otherwise whichever has a
 * key, Google first (its free tier is enough for demos). Text-to-speech stays
 * on OpenAI when OPENAI_API_KEY is set and falls back to the browser's speech
 * synthesis otherwise (see app/api/agent/tts/route.ts).
 *
 * Switching provider changes the embedding space: re-run `bun run ingest`.
 */
export type AiProvider = "google" | "openai";

/** Width of site_content.embedding (supabase/migrations/0001_init.sql). */
export const EMBEDDING_DIMENSIONS = 1536;

const keyFor = (p: AiProvider) =>
  p === "google" ? process.env.GOOGLE_GENERATIVE_AI_API_KEY : process.env.OPENAI_API_KEY;

/** The configured provider, or null when no key is set (the agent then runs offline). */
export function aiProvider(): AiProvider | null {
  const wanted = process.env.AI_PROVIDER;
  // An explicit choice without its key goes offline instead of quietly using the other vendor.
  if (wanted === "google" || wanted === "openai") return keyFor(wanted) ? wanted : null;
  if (keyFor("google")) return "google";
  if (keyFor("openai")) return "openai";
  return null;
}

export const hasAiKey = () => aiProvider() !== null;

function requireProvider(): AiProvider {
  const p = aiProvider();
  if (!p) throw new Error("No AI provider configured: set GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY");
  return p;
}

const google = () => createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
const openai = () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const googleChatId = () => process.env.GOOGLE_CHAT_MODEL ?? "gemini-2.5-flash-lite";

export function chatModel(): LanguageModel {
  return requireProvider() === "google"
    ? google()(googleChatId())
    : openai()(process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini");
}

/**
 * Provider options for chat calls. Gemini 2.5 "thinks" by default and those
 * tokens count against maxTokens, which would cut short our 700-token answers.
 */
export const CHAT_PROVIDER_OPTIONS = { google: { thinkingConfig: { thinkingBudget: 0 } } };

/** Gemini embeds queries and documents differently; OpenAI ignores the purpose. */
export function embeddingModel(purpose: "query" | "document"): EmbeddingModel<string> {
  if (requireProvider() === "google") {
    return google().textEmbeddingModel(process.env.GOOGLE_EMBEDDING_MODEL ?? "gemini-embedding-001", {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType: purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
    });
  }
  return openai().embedding(process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small");
}

/**
 * Below this cosine similarity a pgvector hit counts as "no match". Gemini
 * scores unrelated text high (~0.5 in a smoke test, related text ~0.76), so it
 * needs a higher bar than OpenAI.
 * Tune with VECTOR_MIN_SIMILARITY after re-ingesting.
 */
export function minVectorSimilarity(): number {
  const override = Number(process.env.VECTOR_MIN_SIMILARITY);
  if (override > 0) return override;
  return aiProvider() === "google" ? 0.6 : 0.25;
}

/**
 * Speech-to-text. OpenAI uses Whisper; Google sends the clip to Gemini with a
 * transcription prompt. `vocabulary` lists place names the model should spell right.
 */
export async function transcribe(args: {
  audio: Uint8Array<ArrayBuffer>;
  mimeType: string;
  ext: string;
  lang: "vi" | "en";
  vocabulary: string;
}): Promise<string> {
  if (requireProvider() === "google") {
    const { text } = await generateText({
      model: google()(process.env.GOOGLE_STT_MODEL ?? googleChatId()),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Transcribe this ${args.lang === "vi" ? "Vietnamese" : "English"} speech verbatim. ` +
                `Place names that may occur: ${args.vocabulary} ` +
                "Reply with the transcript only, without quotes or commentary. If there is no speech, reply with nothing.",
            },
            { type: "file", data: args.audio, mimeType: args.mimeType },
          ],
        },
      ],
      temperature: 0,
      maxRetries: 1,
      providerOptions: CHAT_PROVIDER_OPTIONS,
    });
    return text.trim();
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
  // Whisper infers the container from the file name, so give it the right extension.
  const file = new File([args.audio], `speech.${args.ext}`, { type: args.mimeType });
  const result = await client.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_STT_MODEL ?? "whisper-1",
    language: args.lang,
    prompt: args.vocabulary,
  });
  return result.text.trim();
}
