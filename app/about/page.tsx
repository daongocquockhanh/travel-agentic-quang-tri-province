import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { DocPage, DocSection } from "@/components/doc-page";
import { Icon } from "@/components/icon";
import { APP_INFO } from "@/lib/app-info";

export const metadata: Metadata = { title: "About · Quảng Trị Travel Guide" };

export default async function AboutPage() {
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const vi = lang === "vi";
  const contact = APP_INFO.supportEmail;

  const links = [
    { href: "/privacy", label: vi ? "Chính sách quyền riêng tư" : "Privacy policy" },
    { href: "/terms", label: vi ? "Điều khoản sử dụng" : "Terms of use" },
    { href: "/", label: vi ? "Đổi chế độ hướng dẫn" : "Change guide mode" },
  ];

  return (
    <DocPage
      title={APP_INFO.fullName[lang]}
      backHref="/map"
      backLabel={vi ? "Về bản đồ" : "Back to map"}
    >
      <p>
        {vi
          ? "Hướng dẫn viên song ngữ cho tỉnh Quảng Trị: câu chuyện về các di tích, bản đồ toàn tỉnh và lịch trình trong ngày. Câu trả lời về lịch sử dựa trên nội dung đã biên tập và có dẫn nguồn."
          : "A bilingual guide to Quảng Trị Province: the stories of its sites, a map of the province and day plans. History answers are based on edited content with cited sources."}
      </p>

      <ul className="border-border bg-paper-card divide-border mt-5 divide-y rounded-[14px] border">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-fg flex items-center justify-between px-4 py-3.5 text-[15px]"
            >
              {l.label}
              <Icon name="arrow" size={16} className="text-fg-muted" />
            </Link>
          </li>
        ))}
        {contact && (
          <li>
            <a
              href={`mailto:${contact}`}
              className="text-fg flex items-center justify-between px-4 py-3.5 text-[15px]"
            >
              {vi ? "Liên hệ hỗ trợ" : "Contact support"}
              <span className="text-fg-muted text-[13px]">{contact}</span>
            </a>
          </li>
        )}
      </ul>

      <div className="mt-6">
        <DocSection title={vi ? "Nguồn và ảnh" : "Sources and photos"}>
          <p>
            {vi
              ? "Nội dung tổng hợp từ các nguồn được ghi ở cuối mỗi trang địa điểm. Ảnh từ Wikimedia Commons, thuộc về các tác giả theo giấy phép ghi trên trang ảnh."
              : "Content draws on the sources listed at the bottom of each place page. Photos are from Wikimedia Commons, belonging to their authors under the licences shown on each photo’s page."}
          </p>
        </DocSection>
      </div>

      <p className="text-fg-muted mt-8 text-center text-[12px]">
        {vi ? "Phiên bản" : "Version"} {APP_INFO.version}
      </p>
    </DocPage>
  );
}
