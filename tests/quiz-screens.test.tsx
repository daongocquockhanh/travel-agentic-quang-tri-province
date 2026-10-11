// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizQuestion } from "@/lib/quiz-types";

// Node 25's own (flag-gated, half-working) localStorage shadows happy-dom's; use a plain in-memory one.
class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
}
Object.defineProperty(window, "localStorage", { value: new MemoryStorage(), configurable: true });

// next/link needs the app router; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { QuizRunner } = await import("@/components/quiz-runner");
const { PassportGrid } = await import("@/components/passport-grid");
const { passport } = await import("@/lib/passport-store");

const QUESTIONS: QuizQuestion[] = [
  {
    id: "depth",
    answer: 2,
    source: "history",
    vi: { q: "Sâu bao nhiêu?", options: ["8 m", "12 m", "23 m", "40 m"], explain: "Ba giai đoạn." },
    en: {
      q: "How deep?",
      options: ["8 m", "12 m", "23 m", "40 m"],
      explain: "Three phases, to 23 m.",
    },
  },
  {
    id: "children",
    answer: 3,
    source: "history",
    vi: { q: "Bao nhiêu em bé?", options: ["3", "7", "12", "17"], explain: "17 em bé." },
    en: {
      q: "How many children?",
      options: ["3", "7", "12", "17"],
      explain: "Seventeen were born.",
    },
  },
];
/** Question text → a right and a wrong option, whatever order the shuffle picked. */
const RIGHT: Record<string, string> = {
  "How deep?": "23 m",
  "How many children?": "17",
  "Sâu bao nhiêu?": "23 m",
  "Bao nhiêu em bé?": "17",
};
const WRONG: Record<string, string> = {
  "How deep?": "8 m",
  "How many children?": "3",
  "Sâu bao nhiêu?": "8 m",
  "Bao nhiêu em bé?": "3",
};

const SITE = { slug: "vinh-moc", name: "Vinh Moc Tunnels", hero_gradient: "#333" };
const SOURCES = { history: { label: "History", citation: "Provincial museum", href: null } };

const stored = () => JSON.parse(window.localStorage.getItem("qt.passport") ?? "{}");
const heading = () => screen.getByRole("heading", { level: 2 }).textContent!;
/** Option buttons are labelled "A 23 m" etc.; match on the option text at the end. */
const option = (text: string) => screen.getByRole("button", { name: new RegExp(`\\b${text}$`) });

beforeEach(() => {
  window.localStorage.clear();
  passport.clear();
});
afterEach(cleanup);

describe("QuizRunner", () => {
  it("runs a whole attempt: feedback with its source, a result, and the score in the passport", async () => {
    render(<QuizRunner questions={QUESTIONS} lang="en" isDraft sources={SOURCES} site={SITE} />);
    await screen.findByText(/Question 1 of 2/);
    expect(screen.getByText(/draft, waiting for an editor/)).toBeTruthy();

    const first = heading();
    fireEvent.click(option(RIGHT[first]));
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText(/Read more: History/)).toBeTruthy();
    expect(screen.getByText(/Provincial museum/)).toBeTruthy();
    // Options lock once answered.
    expect((option(WRONG[first]) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
    await screen.findByText(/Question 2 of 2/);
    const second = heading();
    fireEvent.click(option(WRONG[second]));
    expect(screen.getByText(/The answer is:/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /See your result/ }));
    await screen.findByText("You answered 1 of 2 correctly");
    expect(screen.getByText(second)).toBeTruthy(); // listed under "questions to look at again"
    expect(stored().quizzes["vinh-moc"]).toMatchObject({ best: 1, total: 2 });
  });

  it("starts over on retake and keeps the best score", async () => {
    passport.recordQuiz("vinh-moc", 2, 2);
    render(
      <QuizRunner questions={QUESTIONS} lang="vi" isDraft={false} sources={SOURCES} site={SITE} />,
    );
    await screen.findByText(/Câu 1 \/ 2/);
    fireEvent.click(option(WRONG[heading()]));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp theo/ }));
    fireEvent.click(option(WRONG[heading()]));
    fireEvent.click(screen.getByRole("button", { name: /Xem kết quả/ }));

    await screen.findByText("Bạn trả lời đúng 0 / 2 câu");
    expect(stored().quizzes["vinh-moc"]).toMatchObject({ best: 2, total: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Làm lại" }));
    await screen.findByText(/Câu 1 \/ 2/);
  });

  it("offers an honest 'I visited' when location can't confirm the visit", async () => {
    render(
      <QuizRunner
        questions={QUESTIONS.slice(0, 1)}
        lang="en"
        isDraft={false}
        sources={SOURCES}
        site={SITE}
      />,
    );
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(option("23 m"));
    fireEvent.click(screen.getByRole("button", { name: /See your result/ }));
    fireEvent.click(await screen.findByRole("button", { name: /I visited this place/ }));
    await screen.findByText(/Visited · self-reported/);
    expect(stored().visits["vinh-moc"]).toMatchObject({ method: "self" });
  });
});

describe("PassportGrid", () => {
  const SITES = [
    { ...SITE, hasQuiz: true },
    { slug: "hien-luong", name: "Hien Luong Bridge", hero_gradient: "#444", hasQuiz: false },
  ];

  it("shows each place's state and counts only stamped places", async () => {
    render(<PassportGrid sites={SITES} lang="en" />);
    expect(screen.getByText("0 of 2 places stamped")).toBeTruthy();
    expect(screen.getAllByText("Not visited yet")).toHaveLength(2);
    expect(screen.getByText("No quiz yet")).toBeTruthy();

    act(() => passport.recordVisit("vinh-moc", "gps"));
    await waitFor(() => expect(screen.getByText("Visited · quiz to do")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Take the quiz" }).getAttribute("href")).toBe(
      "/site/vinh-moc/quiz",
    );

    act(() => passport.recordQuiz("vinh-moc", 4, 6));
    await waitFor(() => expect(screen.getByText("1 of 2 places stamped")).toBeTruthy());
    expect(screen.getByText("Stamped")).toBeTruthy();
    expect(screen.getByText("Best score 4/6")).toBeTruthy();
  });
});
