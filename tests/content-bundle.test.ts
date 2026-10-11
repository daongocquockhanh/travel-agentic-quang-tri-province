import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { listSlugsOnDisk, readQuizFromDisk, readSiteContentFromDisk } from "@/lib/content-source";
import { getQuiz, listContentSlugs, readSiteContent } from "@/lib/content";

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

  it("serves the same quizzes as quiz.yml on disk", async () => {
    for (const slug of await listSlugsOnDisk(DIR)) {
      expect(await getQuiz(slug)).toEqual(await readQuizFromDisk(DIR, slug));
    }
    expect(await getQuiz("nowhere")).toBeNull();
  });

  it("hides a draft quiz when production requires reviewed content", async () => {
    // Vĩnh Mốc's quiz starts as a draft (content/sites/vinh-moc/quiz.yml).
    expect((await getQuiz("vinh-moc"))?.review_status).toBe("draft");
    process.env.CONTENT_REQUIRE_REVIEWED = "true";
    try {
      expect(await getQuiz("vinh-moc")).toBeNull();
    } finally {
      delete process.env.CONTENT_REQUIRE_REVIEWED;
    }
  });
});
