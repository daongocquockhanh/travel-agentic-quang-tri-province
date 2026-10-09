import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { listSlugsOnDisk, readSiteContentFromDisk } from "@/lib/content-source";
import { listContentSlugs, readSiteContent } from "@/lib/content";

const DIR = join(process.cwd(), "content/sites");

// Outside `next dev`, lib/content serves the build-time bundle (Workers have no
// project filesystem). It must hold exactly what is on disk.
describe("content bundle", () => {
  it("lists the same sites as content/sites", async () => {
    expect((await listContentSlugs()).sort()).toEqual((await listSlugsOnDisk(DIR)).sort());
  });

  it("serves the same sections as the markdown on disk", async () => {
    for (const slug of await listSlugsOnDisk(DIR)) {
      expect(await readSiteContent(slug)).toEqual(await readSiteContentFromDisk(DIR, slug));
    }
  });

  it("returns empty content for an unknown site", async () => {
    expect(await readSiteContent("nowhere")).toEqual({ vi: [], en: [] });
  });
});
