import Link from "next/link";
import { Icon } from "@/components/icon";

/**
 * Straight back to the welcome page (/) from the map and chat, which are
 * otherwise the hubs every other screen returns to.
 */
export function HomeButton({ lang, glass = false }: { lang: "vi" | "en"; glass?: boolean }) {
  return (
    <Link
      href="/"
      aria-label={lang === "vi" ? "Trang chủ" : "Home"}
      className={
        "border-border text-fg grid size-[34px] shrink-0 place-items-center rounded-full border " +
        (glass ? "bg-[rgba(247,244,238,0.86)] backdrop-blur-md" : "bg-paper-card")
      }
    >
      <Icon name="home" size={16} />
    </Link>
  );
}
