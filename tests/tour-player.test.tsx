// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tour } from "@/lib/tours";

// Node 25's own (flag-gated, half-working) localStorage shadows happy-dom's; use a plain in-memory one.
const store = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Stands in for SpeechPlayer: records each stop it is asked to read, reports speaking like the real one. */
const begins = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/voice/player", () => ({
  SpeechPlayer: class {
    private state = { speaking: false, key: null as string | null, error: null, item: 0 };
    constructor(private opts: { onChange: (s: unknown) => void }) {}
    unlock() {}
    begin(key: string) {
      this.stop();
      begins.push(key);
    }
    enqueue() {
      if (this.state.speaking) return;
      this.state = { ...this.state, speaking: true };
      this.opts.onChange(this.state);
    }
    stop() {
      if (!this.state.speaking) return;
      this.state = { ...this.state, speaking: false };
      this.opts.onChange(this.state);
    }
  },
}));

const { TourPlayer } = await import("@/components/tour-player");

const TOUR: Tour = {
  lang: "en",
  authored: true,
  review_status: "draft",
  citations: [],
  stops: [1, 2, 3].map((n) => ({
    title: `Stop ${n}`,
    cue: null,
    body: `Stop ${n} tells part of the story of this place, in a few calm sentences for the visitor.`,
  })),
};
const SITE = { slug: "vinh-moc", name: "Vinh Moc Tunnels", hero_gradient: "#333" };

beforeEach(() => {
  begins.length = 0;
  store.clear();
});
afterEach(cleanup);

describe("TourPlayer", () => {
  it("goes quiet when the traveller leaves the page mid-stop", () => {
    const { unmount } = render(<TourPlayer tour={TOUR} site={SITE} lang="en" voice="nova" />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(begins).toEqual(["vinh-moc:0"]);

    unmount();
    // Leaving must not be mistaken for "stop finished" and start reading the next one.
    expect(begins).toEqual(["vinh-moc:0"]);
  });

  it("stays quiet after Pause", () => {
    render(<TourPlayer tour={TOUR} site={SITE} lang="en" voice="nova" />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(begins).toEqual(["vinh-moc:0"]);
  });
});
