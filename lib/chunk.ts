/**
 * Retrieval passages: about a paragraph each (~700 characters), so the agent
 * quotes and cites the part that answers the question rather than a whole
 * section. Used by both the local index and ingest, so they stay aligned.
 */
export const PASSAGE_CHARS = 700;

export function passages(text: string): string[] {
  return chunk(text, PASSAGE_CHARS);
}

const SECTION_CONTEXT: Record<string, string> = {
  overview: "overview tổng quan",
  history: "history lịch sử",
  visit_tips: "visit tips practical mẹo tham quan",
  culture_notes: "customs culture etiquette phong tục văn hóa",
};

/**
 * Text to index or embed for a passage: the passage plus where it comes from,
 * so a paragraph about "the boat" still knows it belongs to Cồn Cỏ's visit tips.
 */
export function contextualize(passage: string, ctx: { names: string; section: string }): string {
  return `${ctx.names} — ${SECTION_CONTEXT[ctx.section] ?? ctx.section}\n${passage}`;
}

/** Split body into ~500-token chunks. Approx 4 chars per token => ~2000 chars per chunk. */
export function chunk(text: string, maxChars = 2000): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (p.length > maxChars) {
      // split long paragraph by sentence
      const sentences = p.split(/(?<=[.!?…])\s+/);
      for (const s of sentences) {
        if ((buf + " " + s).length > maxChars) {
          if (buf) chunks.push(buf.trim());
          buf = s;
        } else {
          buf = buf ? `${buf} ${s}` : s;
        }
      }
      continue;
    }
    if ((buf + "\n\n" + p).length > maxChars) {
      if (buf) chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf.trim());
  return chunks.length ? chunks : [text.trim()];
}
