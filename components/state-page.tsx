import Link from "next/link";
import type { ReactNode } from "react";

/** Bilingual full-page state (VI primary, EN secondary) for errors, 404 and offline. */
export function StatePage({
  titleVi,
  titleEn,
  bodyVi,
  bodyEn,
  children,
}: {
  titleVi: string;
  titleEn: string;
  bodyVi: string;
  bodyEn: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center bg-paper px-6 text-fg">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-fg-muted">Quảng Trị · Vietnam</p>
      <h1 className="mt-2 font-display text-[28px] leading-tight">{titleVi}</h1>
      <p className="font-display text-[17px] italic text-fg-muted">{titleEn}</p>
      <p className="mt-4 text-[15px] leading-[1.55]">{bodyVi}</p>
      <p className="mt-1 text-[14px] leading-[1.55] text-fg-muted">{bodyEn}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {children}
        <Link href="/map" className="rounded-full border border-border px-4 py-2 text-[14px] font-medium text-fg">
          Bản đồ · Map
        </Link>
      </div>
    </main>
  );
}
