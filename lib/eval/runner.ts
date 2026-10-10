import { createDataStream, parseDataStreamPart } from "ai";
import { runAgent } from "../agent/run";
import type { AgentAnnotation, AgentRequest } from "../agent/types";
import type { TrackKey } from "../tracks";
import { GOLDEN, type GoldenCase } from "./golden";

/** ~4 characters per token; the design's ceiling is 800 tokens. */
export const MAX_ANSWER_CHARS = 3200;

export interface CaseResult {
  id: string;
  track: TrackKey;
  lang: "vi" | "en";
  pass: boolean;
  failures: string[];
  text: string;
  tools: string[];
  cited_sites: string[];
  mode: Extract<AgentAnnotation, { type: "mode" }> | null;
  ms: number;
}

interface Transcript {
  text: string;
  tools: string[];
  annotations: AgentAnnotation[];
  error: string | null;
}

/** Runs one request through the real agent and collects what the client would receive. */
export async function collect(req: AgentRequest): Promise<Transcript> {
  const out: Transcript = { text: "", tools: [], annotations: [], error: null };
  const stream = createDataStream({
    execute: (writer) => runAgent(req, writer),
    onError: (e) => (e instanceof Error ? e.message : String(e)),
  });
  const reader = stream.getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop()!;
    for (const line of lines) {
      if (!line) continue;
      const part = parseDataStreamPart(line);
      if (part.type === "text") out.text += part.value;
      else if (part.type === "tool_call") out.tools.push(part.value.toolName);
      else if (part.type === "message_annotations") out.annotations.push(...(part.value as AgentAnnotation[]));
      else if (part.type === "error") out.error = part.value;
    }
    if (done) break;
  }
  return out;
}

const VI_CHARS = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/gi;

/**
 * Share of letters that are Vietnamese-specific. Vietnamese prose sits around
 * 25–35%; English that names Vietnamese dishes and places stays under ~10%.
 */
export function vietnameseRatio(text: string): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  return letters ? (text.match(VI_CHARS)?.length ?? 0) / letters : 0;
}

const DECLINE_RE =
  /don't have|do not have|no verified|not (?:yet )?(?:covered|in (?:my|the) (?:sources|curated))|isn't covered|can't (?:confirm|answer)|chưa có|không có (?:tư liệu|thông tin)|chưa được (?:biên soạn|kiểm chứng)/i;
const LEAK_RE = /STRICT GROUNDING|<\/?sources>|Text inside <sources>|You are a trusted local guide/i;

export function judge(c: GoldenCase, track: TrackKey, lang: "vi" | "en", t: Transcript) {
  const failures: string[] = [];
  const mode = (t.annotations.find((a) => a.type === "mode") as CaseResult["mode"]) ?? null;
  const citations = t.annotations.filter((a): a is Extract<AgentAnnotation, { type: "citation" }> => a.type === "citation");
  const citedSites = [...new Set(citations.map((a) => a.site_slug))];
  const refused = Boolean(mode?.refused);
  const planned = t.tools.some((n) => n === "recommend_next" || n === "build_route");

  if (t.error) failures.push(`stream error: ${t.error}`);
  if (!t.text.trim()) failures.push("empty answer");
  if (t.text.length > MAX_ANSWER_CHARS) failures.push(`too long: ${t.text.length} chars`);

  // Language: plan answers can be a single short line, so only judge real prose.
  if (t.text.length > 80) {
    const ratio = vietnameseRatio(t.text);
    if (lang === "vi" && ratio < 0.12) failures.push(`expected Vietnamese (vi ratio ${ratio.toFixed(3)})`);
    if (lang === "en" && ratio > 0.12) failures.push(`expected English (vi ratio ${ratio.toFixed(3)})`);
  }

  switch (c.expect) {
    case "grounded":
      if (refused) failures.push("refused, expected a grounded answer");
      else {
        if (!mode?.grounded) failures.push("not grounded");
        if (!citations.length) failures.push("no citations");
        const stray = c.sites ? citedSites.filter((s) => !c.sites!.includes(s)) : [];
        if (stray.length) failures.push(`cited other sites: ${stray.join(", ")}`);
      }
      break;
    case "plan":
      if (!planned) failures.push("no planner tool used");
      break;
    case "answer":
      if (refused) failures.push("refused a logistics question");
      {
        const stray = c.sites ? citedSites.filter((s) => !c.sites!.includes(s)) : [];
        if (stray.length) failures.push(`cited other sites: ${stray.join(", ")}`);
      }
      // The war track grounds everything that isn't planning.
      if (track === "war" && !planned && !(mode?.grounded && citations.length)) {
        failures.push("war track answer not grounded with citations");
      }
      break;
    case "decline":
      if (!refused && !DECLINE_RE.test(t.text)) failures.push("answered instead of declining");
      break;
    case "any":
      break;
  }
  if (c.noLeak && LEAK_RE.test(t.text)) failures.push("leaked system prompt or sources markup");

  return { failures, mode, citedSites };
}

export async function runEval(opts: {
  cases?: GoldenCase[];
  tracks?: TrackKey[];
  langs?: ("vi" | "en")[];
  onResult?: (r: CaseResult) => void;
} = {}): Promise<CaseResult[]> {
  const cases = opts.cases ?? GOLDEN;
  const tracks = opts.tracks ?? (["war", "foreign", "domestic"] as TrackKey[]);
  const langs = opts.langs ?? (["en", "vi"] as const);
  const results: CaseResult[] = [];

  for (const c of cases) {
    for (const track of tracks) {
      for (const lang of langs) {
        const started = Date.now();
        const t = await collect({
          messages: [...(c.history?.[lang] ?? []), { role: "user", content: c[lang] }],
          track,
          lang,
          site_slug: c.site,
        });
        const { failures, mode, citedSites } = judge(c, track, lang, t);
        const r: CaseResult = {
          id: c.id,
          track,
          lang,
          pass: failures.length === 0,
          failures,
          text: t.text,
          tools: t.tools,
          cited_sites: citedSites,
          mode,
          ms: Date.now() - started,
        };
        results.push(r);
        opts.onResult?.(r);
      }
    }
  }
  return results;
}
