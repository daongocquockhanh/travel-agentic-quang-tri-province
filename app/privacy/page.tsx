import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { DocPage, DocSection } from "@/components/doc-page";
import { APP_INFO } from "@/lib/app-info";

export const metadata: Metadata = { title: "Privacy · Quảng Trị Travel Guide" };

/**
 * Privacy policy. Linked from the About page and both store listings; keep it
 * in step with what the code actually sends and stores (docs/STORE_RELEASE.md
 * maps each item to the stores' data-safety questions).
 */
export default async function PrivacyPage() {
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const contact = APP_INFO.supportEmail;
  const mail = contact ? <a href={`mailto:${contact}`}>{contact}</a> : null;

  if (lang === "vi") {
    return (
      <DocPage
        title="Chính sách quyền riêng tư"
        updated={`Cập nhật ${APP_INFO.policiesUpdated}`}
        backLabel="Quay lại"
      >
        <DocSection title="Tóm tắt">
          <p>
            Ứng dụng không có tài khoản, không yêu cầu đăng nhập và không bán dữ liệu của bạn. Chúng
            tôi chỉ dùng những gì cần thiết để trả lời câu hỏi và hiển thị bản đồ.
          </p>
        </DocSection>
        <DocSection title="Câu hỏi bằng chữ và giọng nói">
          <ul>
            <li>
              Câu hỏi bạn nhập được gửi đến máy chủ của chúng tôi và đến nhà cung cấp AI (Google
              Gemini, hoặc OpenAI) để tạo câu trả lời.
            </li>
            <li>
              Khi bạn nhấn giữ nút micrô, đoạn ghi âm được gửi đi để chuyển thành chữ rồi bị bỏ đi;
              chúng tôi không lưu ghi âm.
            </li>
            <li>
              Chúng tôi không lưu lịch sử trò chuyện trên máy chủ. Cuộc trò chuyện gần nhất chỉ được
              lưu trên máy của bạn.
            </li>
            <li>
              Khi hướng dẫn viên không có nội dung đã kiểm duyệt cho một câu hỏi, câu hỏi đó (không
              kèm thông tin nhận dạng) được ghi lại để biên tập viên bổ sung nội dung.
            </li>
            <li>
              Nếu bạn báo lỗi một câu trả lời, chúng tôi lưu câu hỏi, câu trả lời và lý do để xem
              xét.
            </li>
          </ul>
        </DocSection>
        <DocSection title="Vị trí">
          <p>
            Vị trí chỉ được dùng sau khi bạn bật nó. Vị trí giúp sắp xếp địa điểm theo khoảng cách,
            kể chuyện khi bạn đến nơi, và được gửi kèm câu hỏi kiểu “gần đây có gì”. Chúng tôi không
            lưu và không theo dõi vị trí của bạn.
          </p>
        </DocSection>
        <DocSection title="Lưu trên thiết bị">
          <p>
            Lịch trình, cuộc trò chuyện gần nhất, ngôn ngữ và chế độ hướng dẫn được lưu trên máy của
            bạn. Xoá dữ liệu ứng dụng sẽ xoá chúng.
          </p>
        </DocSection>
        <DocSection title="Dịch vụ bên thứ ba">
          <ul>
            <li>Cloudflare: lưu trữ ứng dụng và máy chủ.</li>
            <li>
              Google Gemini / OpenAI: tạo câu trả lời, chuyển giọng nói thành chữ và đọc câu trả
              lời.
            </li>
            <li>Mapbox: bản đồ và thời gian di chuyển.</li>
            <li>Wikimedia Commons: ảnh địa điểm.</li>
            <li>Supabase: nội dung đã kiểm duyệt, câu hỏi chưa có nội dung và báo lỗi.</li>
            <li>
              Upstash: giới hạn số yêu cầu theo địa chỉ IP để chống lạm dụng; không lưu lâu dài.
            </li>
          </ul>
          <p>
            Các dịch vụ này xử lý dữ liệu theo chính sách riêng của họ và có thể thấy địa chỉ IP của
            bạn.
          </p>
        </DocSection>
        <DocSection title="Trẻ em">
          <p>Ứng dụng dành cho mọi lứa tuổi và không cố ý thu thập thông tin cá nhân của trẻ em.</p>
        </DocSection>
        <DocSection title="Liên hệ">
          <p>
            Câu hỏi về quyền riêng tư hoặc yêu cầu xoá một báo lỗi bạn đã gửi:{" "}
            {mail ?? "liên hệ qua trang ứng dụng trên App Store hoặc Google Play"}.
          </p>
        </DocSection>
      </DocPage>
    );
  }

  return (
    <DocPage
      title="Privacy policy"
      updated={`Updated ${APP_INFO.policiesUpdated}`}
      backLabel="Back"
    >
      <DocSection title="In short">
        <p>
          There are no accounts, no sign-in, and we don’t sell your data. We only use what we need
          to answer your questions and show the map.
        </p>
      </DocSection>
      <DocSection title="Typed and spoken questions">
        <ul>
          <li>
            Questions you type are sent to our server and to an AI provider (Google Gemini, or
            OpenAI) to write the answer.
          </li>
          <li>
            When you hold the mic button, the recording is sent to be turned into text and then
            discarded; we don’t keep recordings.
          </li>
          <li>
            We don’t keep chat history on our servers. Your most recent chat is saved on your device
            only.
          </li>
          <li>
            When the guide has no reviewed content for a question, the question (with nothing that
            identifies you) is logged so editors can add content.
          </li>
          <li>
            If you report an answer, we keep the question, the answer and your reason for review.
          </li>
        </ul>
      </DocSection>
      <DocSection title="Location">
        <p>
          Location is used only after you turn it on. It sorts places by distance, starts a site’s
          story when you arrive, and is sent along with questions like “what’s near me”. We don’t
          store or track it.
        </p>
      </DocSection>
      <DocSection title="Stored on your device">
        <p>
          Your plan, latest chat, language and guide mode are saved on your device. Clearing the
          app’s data removes them.
        </p>
      </DocSection>
      <DocSection title="Third-party services">
        <ul>
          <li>Cloudflare: hosts the app and its server.</li>
          <li>Google Gemini / OpenAI: write answers, transcribe speech and read answers aloud.</li>
          <li>Mapbox: the map and travel times.</li>
          <li>Wikimedia Commons: place photos.</li>
          <li>Supabase: reviewed content, unanswered questions and answer reports.</li>
          <li>Upstash: per-IP request limits against abuse; not kept long-term.</li>
        </ul>
        <p>These services handle data under their own policies and can see your IP address.</p>
      </DocSection>
      <DocSection title="Children">
        <p>
          The app is suitable for all ages and doesn’t knowingly collect personal information from
          children.
        </p>
      </DocSection>
      <DocSection title="Contact">
        <p>
          Privacy questions, or to remove a report you sent:{" "}
          {mail ?? "use the contact on the App Store or Google Play listing"}.
        </p>
      </DocSection>
    </DocPage>
  );
}
