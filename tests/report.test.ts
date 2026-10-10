import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/report/route";

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/agent/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe("POST /api/agent/report", () => {
  it("accepts a report and logs it when no database is configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await post({
      reason: "wrong",
      question: "When was Vịnh Mốc built?",
      answer: "In 1990.",
      track: "war",
      lang: "en",
      site_slug: "vinh-moc",
    });
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledWith("[answer_report]", expect.stringContaining("vinh-moc"));
  });

  it("rejects unknown reasons, empty answers and non-JSON bodies", async () => {
    expect((await post({ reason: "spam", question: "q", answer: "a" })).status).toBe(400);
    expect((await post({ reason: "other", question: "q", answer: "" })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
  });
});
