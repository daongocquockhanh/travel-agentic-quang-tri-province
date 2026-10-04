import { getLocale } from "next-intl/server";
import { ChatScreen } from "@/components/chat-screen";
import { getSite } from "@/lib/sites";
import { isTrackKey, type TrackKey } from "@/lib/tracks";

interface Props {
  searchParams: Promise<{ track?: string; site?: string; intent?: string; q?: string }>;
}

export default async function ChatPage({ searchParams }: Props) {
  const { track: trackParam, site: siteParam, intent, q } = await searchParams;
  const site = siteParam ? await getSite(siteParam) : null;
  const track: TrackKey | null = trackParam && isTrackKey(trackParam) ? trackParam : null;
  const lang = (await getLocale()) === "vi" ? "vi" : "en";

  return (
    <ChatScreen
      // Remount when the context changes so a new site starts a fresh thread.
      key={`${site?.slug ?? "-"}:${intent ?? "-"}`}
      initialTrack={track ?? site?.tracks[0] ?? "foreign"}
      trackFromUrl={Boolean(track)}
      initialLang={lang}
      site={site && { slug: site.slug, name_vi: site.name_vi, name_en: site.name_en }}
      intent={intent === "arrival_story" ? "arrival_story" : undefined}
      initialQuestion={q?.slice(0, 500)}
    />
  );
}
