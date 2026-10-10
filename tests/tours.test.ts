import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readTourScripts } from "@/lib/content";
import { listSlugsOnDisk, readTourScriptsFromDisk } from "@/lib/content-source";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import { getTour } from "@/lib/sites";
import type { SiteContentSection } from "@/lib/sites";
import {
  buildTour,
  listenSeconds,
  parseTourScript,
  speechPieces,
  tourFromSections,
} from "@/lib/tours";

const DIR = join(process.cwd(), "content/sites");

const section = (
  s: SiteContentSection["section"],
  body: string,
  extra: Partial<SiteContentSection> = {},
): SiteContentSection => ({
  section: s,
  body,
  source_citation: `${s} source`,
  sources: [`https://example.org/${s}`],
  review_status: "draft",
  ...extra,
});

describe("tour scripts", () => {
  it("splits stops on ## headings, with an optional > cue", () => {
    const stops = parseTourScript(
      "Ignored preamble.\n\n## First stop\n> At the gate\n\nOne.\n\nTwo.\n\n## Second stop\n\nThree, no cue.",
    );
    expect(stops).toEqual([
      { title: "First stop", cue: "At the gate", body: "One.\n\nTwo." },
      { title: "Second stop", cue: null, body: "Three, no cue." },
    ]);
  });

  it("uses the script, citing only the sections it is based on", () => {
    const sections = [
      section("overview", "O"),
      section("history", "H"),
      section("visit_tips", "V"),
    ];
    const tour = buildTour(
      sections,
      {
        body: "## A\nText a.\n## B\nText b.",
        based_on: ["overview", "history"],
        review_status: "reviewed",
      },
      "en",
    )!;
    expect(tour.authored).toBe(true);
    expect(tour.stops.map((s) => s.title)).toEqual(["A", "B"]);
    expect(tour.citations.map((c) => c.citation)).toEqual(["overview source", "history source"]);
    // A reviewed script over draft sections is still a draft.
    expect(tour.review_status).toBe("draft");
  });

  it("falls back to the sections, one stop per history paragraph", () => {
    const tour = tourFromSections(
      [
        section("visit_tips", "Tips."),
        section("overview", "Intro."),
        section("history", "Part one.\n\nPart two."),
      ],
      "en",
    );
    expect(tour.authored).toBe(false);
    expect(tour.stops.map((s) => s.title)).toEqual([
      "Welcome",
      "The story · 1/2",
      "The story · 2/2",
      "Before you go",
    ]);
    expect(buildTour([], null, "vi")).toBeNull();
  });

  it("breaks text into speakable pieces without splitting numbers", () => {
    const pieces = speechPieces(
      "In 1962 the flagpole reached 38.6 metres. It was tall. Loudspeakers broadcast across the river in a parallel battle.\n\nNew paragraph.",
      40,
    );
    expect(pieces).toEqual([
      "In 1962 the flagpole reached 38.6 metres.",
      "It was tall. Loudspeakers broadcast across the river in a parallel battle.",
      "New paragraph.",
    ]);
  });

  it("estimates listening time", () => {
    expect(listenSeconds(Array(150).fill("word").join(" "), "en")).toBe(60);
  });
});

describe("tour content", () => {
  it("bundles the same scripts as on disk", async () => {
    for (const slug of await listSlugsOnDisk(DIR)) {
      expect(await readTourScripts(slug)).toEqual(await readTourScriptsFromDisk(DIR, slug));
    }
  });

  it("gives every catalogue site a tour in both languages", async () => {
    for (const site of SAMPLE_SITES) {
      for (const lang of ["vi", "en"] as const) {
        const tour = await getTour(site.slug, lang);
        expect(tour?.stops.length, `${site.slug}/${lang}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("has narrated scripts for the main heritage sites, matching across languages", async () => {
    for (const slug of [
      "vinh-moc",
      "hien-luong",
      "khe-sanh",
      "truong-son",
      "thach-han",
      "la-vang",
    ]) {
      const [vi, en] = await Promise.all([getTour(slug, "vi"), getTour(slug, "en")]);
      expect(vi?.authored && en?.authored, slug).toBe(true);
      expect(vi!.stops.length, slug).toBe(en!.stops.length);
      expect(en!.citations.length, slug).toBeGreaterThan(0);
    }
  });
});
