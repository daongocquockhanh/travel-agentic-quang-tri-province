/**
 * Incremental sentence splitter for streamed text. Feed it the growing
 * message, and it hands back the speakable pieces that are complete, so TTS
 * can start on the first sentence while the rest is still streaming.
 */
export class SentenceBuffer {
  private consumed = 0;

  /** @param minChars pieces shorter than this are merged with the next sentence to save TTS round-trips */
  constructor(private minChars = 60) {}

  /** Returns newly completed pieces of `fullText` since the last call. */
  push(fullText: string): string[] {
    const pending = fullText.slice(this.consumed);
    const out: string[] = [];
    let start = 0;
    // A sentence ends at . ! ? … plus any closing quote/bracket and trailing [n]
    // citation refs, then whitespace; or at a paragraph break. Requiring
    // whitespace after the stop keeps "2.5 km" in one piece.
    const re = /[.!?…]["'”)\]]*(?:\s*\[\d+\])*\s+|\n{2,}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pending))) {
      const end = m.index + m[0].length;
      if (end - start >= this.minChars || /\n{2,}/.test(m[0])) {
        const piece = pending.slice(start, end).trim();
        if (piece) out.push(piece);
        start = end;
      }
    }
    this.consumed += start;
    return out;
  }

  /** Whatever is left once the stream has finished. */
  flush(fullText: string): string[] {
    const rest = fullText.slice(this.consumed).trim();
    this.consumed = fullText.length;
    return rest ? [rest] : [];
  }
}
