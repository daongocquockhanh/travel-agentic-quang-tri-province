import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aiProvider, embeddingModel, hasAiKey, minVectorSimilarity } from "@/lib/ai/provider";

const saved = { ...process.env };

beforeEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.VECTOR_MIN_SIMILARITY;
});

afterEach(() => {
  process.env = { ...saved };
});

describe("aiProvider", () => {
  it("is null with no key, so the agent runs offline", () => {
    expect(aiProvider()).toBeNull();
    expect(hasAiKey()).toBe(false);
  });

  it("picks whichever provider has a key, preferring Google", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(aiProvider()).toBe("openai");
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-test";
    expect(aiProvider()).toBe("google");
  });

  it("honours AI_PROVIDER when that provider has a key", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-test";
    process.env.AI_PROVIDER = "openai";
    expect(aiProvider()).toBe("openai");
  });

  it("goes offline rather than silently switching when the chosen provider has no key", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_PROVIDER = "google";
    expect(aiProvider()).toBeNull();
  });
});

describe("embeddingModel", () => {
  it("uses Gemini embeddings when Google is the provider", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-test";
    const model = embeddingModel("query");
    expect(model.provider).toContain("google");
    expect(model.modelId).toBe("gemini-embedding-001");
  });

  it("uses OpenAI embeddings when OpenAI is the provider", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(embeddingModel("document").modelId).toBe("text-embedding-3-small");
  });

  it("throws without a key", () => {
    expect(() => embeddingModel("query")).toThrow(/no AI provider/i);
  });
});

describe("minVectorSimilarity", () => {
  it("has a per-provider default and an env override", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(minVectorSimilarity()).toBe(0.25);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-test";
    expect(minVectorSimilarity()).toBe(0.6);
    process.env.VECTOR_MIN_SIMILARITY = "0.7";
    expect(minVectorSimilarity()).toBe(0.7);
  });
});
