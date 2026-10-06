import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkContent } from "@/lib/content-check";

const REAL = join(process.cwd(), "content/sites");

describe("content/sites (the real content)", () => {
  it("passes the editorial checks", async () => {
    const report = await checkContent(REAL);
    expect(report.errors).toEqual([]);
  });

  it("has VI and EN content for all ten sites", async () => {
    const report = await checkContent(REAL);
    expect(Object.keys(report.status)).toHaveLength(10);
    for (const [slug, langs] of Object.entries(report.status)) {
      expect(Object.keys(langs.vi).sort(), slug).toEqual(Object.keys(langs.en).sort());
      expect(Object.keys(langs.en), slug).toEqual(expect.arrayContaining(["overview", "history", "visit_tips"]));
    }
  });

  it("blocks production ingest while sections are drafts", async () => {
    const report = await checkContent(REAL, { strict: true });
    expect(report.errors.some((e) => e.includes("not yet reviewed"))).toBe(true);
  });
});

describe("checkContent rules", () => {
  let dir: string;
  const file = (p: string) => join(dir, p);
  const replaceIn = async (p: string, a: string | RegExp, b: string) => {
    const s = await readFile(file(p), "utf8");
    expect(s).toMatch(a);
    await writeFile(file(p), s.replace(a, b));
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "qt-content-"));
    await cp(REAL, dir, { recursive: true });
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const errorsFor = async () => (await checkContent(dir)).errors;

  it("requires a citation on war and religious history", async () => {
    await replaceIn("khe-sanh/en/history.md", /source_citation: .*\n/, "");
    expect(await errorsFor()).toContainEqual(expect.stringMatching(/khe-sanh\/en\/history\.md: source_citation is required/));
  });

  it("requires the same sections in both languages", async () => {
    await rm(file("truong-son/vi/culture_notes.md"));
    expect(await errorsFor()).toContainEqual(expect.stringMatching(/truong-son: vi has .* but en has/));
  });

  it("requires every catalogue site and the required sections", async () => {
    await rm(file("con-co"), { recursive: true });
    await rm(file("cua-tung/en/visit_tips.md"));
    const errors = await errorsFor();
    expect(errors).toContainEqual(expect.stringMatching(/con-co: no content directory/));
    expect(errors).toContainEqual(expect.stringMatching(/cua-tung\/en\/visit_tips\.md: missing/));
  });

  it("catches meta.yml drifting from the app catalogue", async () => {
    await replaceIn("la-vang/meta.yml", "type: religious", "type: nature");
    await replaceIn("dong-ha/meta.yml", "lat: 16.8167", "lat: 16.9");
    const errors = await errorsFor();
    expect(errors).toContainEqual(expect.stringMatching(/la-vang\/meta\.yml: type differs/));
    expect(errors).toContainEqual(expect.stringMatching(/dong-ha\/meta\.yml: geom is more than 500 m/));
  });

  it("rejects invalid review status, bad frontmatter, placeholders and non-URL sources", async () => {
    await replaceIn("cua-viet/en/overview.md", "review_status: draft", "review_status: approved");
    await replaceIn("cua-viet/vi/history.md", "lang: vi", "lang: en");
    await replaceIn("thach-han/en/visit_tips.md", "Bring insect repellent", "TODO add tips. Bring insect repellent");
    await replaceIn("hien-luong/en/overview.md", "  - https://en.wikipedia.org", "  - en.wikipedia.org");
    const errors = await errorsFor();
    expect(errors).toContainEqual(expect.stringMatching(/cua-viet\/en\/overview\.md: review_status must be/));
    expect(errors).toContainEqual(expect.stringMatching(/cua-viet\/vi\/history\.md: frontmatter lang/));
    expect(errors).toContainEqual(expect.stringMatching(/thach-han\/en\/visit_tips\.md: contains a placeholder/));
    expect(errors).toContainEqual(expect.stringMatching(/hien-luong\/en\/overview\.md: sources must be/));
  });

  it("treats reviewed sections as reviewed", async () => {
    await replaceIn("cua-tung/en/overview.md", "review_status: draft", "review_status: reviewed");
    const report = await checkContent(dir);
    expect(report.status["cua-tung"].en.overview).toBe("reviewed");
    expect(report.warnings.some((w) => w.startsWith("cua-tung/en/overview.md"))).toBe(false);
  });
});
