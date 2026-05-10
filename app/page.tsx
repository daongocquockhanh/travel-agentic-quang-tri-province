import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10">
      <h1 className="text-center font-serif text-3xl text-[#0F4C5C]">{t("title")}</h1>
      <p className="text-center text-neutral-700">{t("subtitle")}</p>
      <Link
        href="/map"
        className="rounded-full bg-[#0F4C5C] px-6 py-3 text-white transition hover:bg-[#0b3a47]"
      >
        {t("cta")}
      </Link>
      <p className="mt-8 text-center text-xs text-neutral-500">M1 scaffold · {t("milestone")}</p>
    </main>
  );
}
