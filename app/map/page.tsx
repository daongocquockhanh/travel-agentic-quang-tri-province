import Link from "next/link";

interface Props {
  searchParams: Promise<{ track?: string }>;
}

export default async function MapPage({ searchParams }: Props) {
  const { track } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center justify-center gap-4 bg-paper px-6 py-10 text-fg">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-fg-muted">
        Map view · placeholder
      </p>
      <h1 className="font-display text-2xl">M2 — coming next</h1>
      {track && (
        <p className="text-sm text-fg-muted">
          Picked track: <span className="font-mono">{track}</span>
        </p>
      )}
      <Link
        href="/"
        className="rounded-full border border-border bg-paper-card px-4 py-2 text-sm transition hover:bg-bg-sunk"
      >
        ← Back to track picker
      </Link>
    </main>
  );
}
