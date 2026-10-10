import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { DocPage, DocSection } from "@/components/doc-page";
import { APP_INFO } from "@/lib/app-info";

export const metadata: Metadata = { title: "Terms · Quảng Trị Travel Guide" };

export default async function TermsPage() {
  const lang = (await getLocale()) === "vi" ? "vi" : "en";

  if (lang === "vi") {
    return (
      <DocPage
        title="Điều khoản sử dụng"
        updated={`Cập nhật ${APP_INFO.policiesUpdated}`}
        backLabel="Quay lại"
      >
        <DocSection title="Câu trả lời do AI tạo">
          <p>
            Hướng dẫn viên dùng AI. Câu trả lời về lịch sử và di tích dựa trên nội dung đã được biên
            tập và có dẫn nguồn, nhưng vẫn có thể sai. Nội dung đánh dấu “bản nháp” chưa được biên
            tập viên kiểm tra. Hãy dùng nút “Báo lỗi” nếu bạn thấy câu trả lời sai hoặc thiếu tôn
            trọng.
          </p>
        </DocSection>
        <DocSection title="Thông tin tham quan">
          <p>
            Giờ mở cửa, giá vé và thời gian di chuyển chỉ mang tính tham khảo và có thể thay đổi.
            Hãy kiểm tra tại chỗ trước khi đi, đặc biệt với các chuyến tàu ra đảo Cồn Cỏ.
          </p>
        </DocSection>
        <DocSection title="An toàn">
          <p>
            Quảng Trị vẫn còn bom mìn và vật liệu chưa nổ ở một số khu vực. Luôn đi trên lối đi đã
            đánh dấu, không chạm vào vật lạ, và làm theo hướng dẫn của ban quản lý di tích.
          </p>
        </DocSection>
        <DocSection title="Tôn trọng di tích">
          <p>
            Nhiều nơi là nghĩa trang và di tích chiến tranh. Hãy ăn mặc kín đáo và giữ yên lặng.
          </p>
        </DocSection>
        <DocSection title="Sử dụng hợp lý">
          <p>
            Không dùng ứng dụng để gửi nội dung trái pháp luật hoặc gây quá tải cho dịch vụ. Chúng
            tôi có thể giới hạn số yêu cầu.
          </p>
        </DocSection>
        <DocSection title="Nội dung và ảnh">
          <p>
            Ảnh địa điểm lấy từ Wikimedia Commons theo giấy phép của tác giả; nhấn “Ảnh: Wikimedia
            Commons” để xem tác giả và giấy phép. Nguồn tư liệu được liệt kê ở cuối mỗi trang địa
            điểm.
          </p>
        </DocSection>
      </DocPage>
    );
  }

  return (
    <DocPage title="Terms of use" updated={`Updated ${APP_INFO.policiesUpdated}`} backLabel="Back">
      <DocSection title="AI-generated answers">
        <p>
          The guide uses AI. History and site answers are based on edited content with cited
          sources, but they can still be wrong. Content marked “draft” hasn’t been checked by an
          editor yet. Use “Report” on any answer that is wrong or disrespectful.
        </p>
      </DocSection>
      <DocSection title="Visiting information">
        <p>
          Opening hours, ticket prices and travel times are a guide only and can change. Check
          locally before you go, especially boats to Cồn Cỏ Island.
        </p>
      </DocSection>
      <DocSection title="Safety">
        <p>
          Unexploded ordnance remains in parts of Quảng Trị. Stay on marked paths, never touch
          unknown objects, and follow site staff.
        </p>
      </DocSection>
      <DocSection title="Respect at memorial sites">
        <p>Many places are cemeteries and war memorials. Dress modestly and keep quiet.</p>
      </DocSection>
      <DocSection title="Fair use">
        <p>
          Don’t use the app to send unlawful content or overload the service. We may limit requests.
        </p>
      </DocSection>
      <DocSection title="Content and photos">
        <p>
          Place photos come from Wikimedia Commons under their authors’ licences; tap “Photo:
          Wikimedia Commons” to see the author and licence. Sources are listed at the bottom of each
          place page.
        </p>
      </DocSection>
    </DocPage>
  );
}
