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
