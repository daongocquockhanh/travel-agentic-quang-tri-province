"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icon";

export type TabKey = "explore" | "tours" | "guide" | "plan";

/** Height of the bar above the home indicator; screens pad by this plus --safe-bottom. */
export const TAB_BAR_PX = 58;

const TABS: {
  key: TabKey;
  href: string;
  icon: "pin" | "headphones" | "mic" | "route";
  en: string;
  vi: string;
}[] = [
  { key: "explore", href: "/map", icon: "pin", en: "Explore", vi: "Khám phá" },
  { key: "tours", href: "/tours", icon: "headphones", en: "Tours", vi: "Thuyết minh" },
  { key: "guide", href: "/chat", icon: "mic", en: "Guide", vi: "Hỏi đáp" },
  { key: "plan", href: "/map?tab=plan", icon: "route", en: "Plan", vi: "Lộ trình" },
];

function activeTab(pathname: string, params: URLSearchParams): TabKey | null {
  // /map?plan=a,b (a shared route) opens the plan too.
  if (pathname.startsWith("/map"))
    return params.get("tab") === "plan" || params.has("plan") ? "plan" : "explore";
  if (pathname.startsWith("/tours")) return "tours";
  if (pathname.startsWith("/chat")) return "guide";
  return null;
}

/**
 * The app's top-level sections, always one tap away (like any travel app),
 * instead of reaching them through back buttons and cards.
 */
export function TabBar(props: { lang: "vi" | "en"; className?: string }) {
  // useSearchParams needs a Suspense boundary on statically rendered pages.
  return (
    <Suspense fallback={<Bar {...props} active={null} />}>
      <ActiveBar {...props} />
    </Suspense>
  );
}

function ActiveBar(props: { lang: "vi" | "en"; className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return <Bar {...props} active={activeTab(pathname, new URLSearchParams(params.toString()))} />;
}

function Bar({
  lang,
  className = "",
  active,
}: {
  lang: "vi" | "en";
  className?: string;
  active: TabKey | null;
}) {
  return (
    <nav
      aria-label={lang === "vi" ? "Điều hướng chính" : "Main"}
      className={
        "border-border bg-paper/95 z-40 border-t pb-[var(--safe-bottom)] backdrop-blur-md " +
        className
      }
    >
      <ul className="mx-auto grid max-w-[420px] grid-cols-4" style={{ height: TAB_BAR_PX }}>
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors " +
                  (on ? "text-primary" : "text-fg-muted hover:text-fg")
                }
              >
                <span
                  className={
                    "grid h-7 w-12 place-items-center rounded-full transition-colors " +
                    (on ? "bg-primary/10" : "")
                  }
                >
                  <Icon name={t.icon} size={19} />
                </span>
                {lang === "vi" ? t.vi : t.en}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
