import { getLocale } from "next-intl/server";
import { TrackPicker } from "@/components/track-picker";

export default async function Home() {
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[420px] bg-paper text-fg">
      <TrackPicker initialLang={lang} />
    </main>
  );
}
