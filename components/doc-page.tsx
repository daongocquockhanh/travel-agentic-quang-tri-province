import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

/** Plain reading layout for the About, Privacy and Terms pages. */
export function DocPage({
  title,
  updated,
  backHref = "/about",
  backLabel,
  children,
}: {
  title: string;
  updated?: string;
  backHref?: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-paper text-fg mx-auto min-h-dvh w-full max-w-[420px] px-5 pt-[calc(0.875rem+var(--safe-top))] pb-[calc(2.5rem+var(--safe-bottom))]">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="border-border bg-paper-card text-fg grid size-9 place-items-center rounded-full border"
      >
        <Icon name="back" size={18} />
      </Link>
      <h1 className="font-display mt-5 text-[28px] leading-tight font-medium">{title}</h1>
      {updated && <p className="text-fg-muted mt-1 text-[13px]">{updated}</p>}
      <div className="doc mt-5 text-[15px] leading-[1.6]">{children}</div>
    </main>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="font-display text-[19px] leading-snug font-medium">{title}</h2>
      <div className="[&_a]:text-primary mt-2 space-y-2.5 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
