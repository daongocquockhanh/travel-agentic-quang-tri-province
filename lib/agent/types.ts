import type { SampleSite } from "@/lib/sample-sites";
import type { SiteContentSection } from "@/lib/sites";
import type { TrackKey } from "@/lib/tracks";

export type SiteType = SampleSite["type"];
export type Lang = "vi" | "en";
export type Section = SiteContentSection["section"];

/** One retrieved piece of curated content. */
export interface CuratedChunk {
  site_slug: string;
  section: Section;
  lang: Lang;
  body: string;
  source_citation: string | null;
  score: number;
}

/** Citation chip payload sent to the client as a message annotation. */
export interface CitationRef {
  /** 1-based number the answer uses in `[n]` markers. */
  n: number;
  site_slug: string;
  section: Section;
  source: string;
}

export interface AgentRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  track: TrackKey;
  lang: Lang;
  lat?: number;
  lng?: number;
  site_slug?: string;
  intent?: "arrival_story";
}

/** Annotation shape the chat UI reads off each assistant message. */
export type AgentAnnotation =
  | { type: "citation"; n: number; site_slug: string; section: string; source: string }
  | { type: "mode"; grounded: boolean; offline: boolean; refused: boolean };
