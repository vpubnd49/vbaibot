import fs from "node:fs";
import path from "node:path";
import { renderAdminDocx } from "../src/documents/render-admin-docx.js";
import type { AdminDocument } from "../src/documents/admin-document-schema.js";
import { loginWithStoredCredentials } from "../src/zalo/zalo-client.js";

const ACCOUNT_ID = "acc-0984310011";
const THREAD_ID = "1049933544839800796"; // Trương Hải Châu

async function main() {
  console.log("=== 1. Tạo file Word chuẩn Nghị định 30 ===");
  const doc: AdminDocument = {
    heThong: "nha_nuoc_nd30",
    loaiVanBan: "thong_bao",
    coQuanCapTren: "ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG",
    coQuanBanHanh: "VĂN PHÒNG",
    soKyHieu: "Số:       /TB-VP",
    diaDanh: "Lâm Đồng",
    ngay: "12",
    thang: "09",
    nam: "2026",
    trichYeu: "Kết luận của Lãnh đạo Ủy ban nhân dân tỉnh tại cuộc họp tháo gỡ khó khăn, vướng mắc cho các dự án đầu tư và triển khai một số nhiệm vụ trọng tâm",
    sections: [
      {
        heading: "I. VỀ THÁO GỠ KHÓ KHĂN, VƯỚNG MẮC CHO CÁC DỰ ÁN ĐẦU TƯ TRỌNG ĐIỂM",
        paragraphs: [
          "Ngày 12 tháng 09 năm 2026, Lãnh đạo Ủy ban nhân dân tỉnh đã chủ trì cuộc họp nghe báo cáo, xem xét chỉ đạo tháo gỡ khó khăn, vướng mắc cho các dự án đầu tư; phương án trang bị phương tiện công vụ cấp xã và nghĩa vụ tài chính đất đai trên địa bàn tỉnh.",
          "Sau khi nghe các Ban Quản lý dự án, lãnh đạo các Sở, ngành báo cáo và ý kiến thảo luận của các đồng chí Phó Chủ tịch UBND tỉnh, Lãnh đạo UBND tỉnh kết luận và chỉ đạo nguyên tắc xử lý: Toàn bộ các dự án đầu tư công, dự án ngoài ngân sách phải được rà soát, phân loại rõ ràng theo từng lĩnh vực (Du lịch, Nông nghiệp, Công nghiệp, Giao thông, Hạ tầng đô thị). Đồng chí lãnh đạo phụ trách lĩnh vực, địa bàn nào thì trực tiếp chỉ đạo, tháo gỡ khó khăn xuyên suốt từ đầu đến cuối, không đùn đẩy trách nhiệm.",
        ],
        items: [
          "Phân công đồng chí Hiệp - Tổ trưởng trực tiếp chủ trì, cùng các đồng chí Phó Chủ tịch phụ trách các khối ngành tổ chức làm việc với từng chủ đầu tư để tháo gỡ cụ thể từng khó khăn của dự án.",
          "Giao đồng chí Hải theo dõi, đôn đốc, tập hợp tình hình xử lý và tổng hợp báo cáo định kỳ cho Thường trực Ủy ban nhân dân tỉnh.",
          "Đối với các công trình trọng điểm (Dự án Quảng trường Trung tâm giai đoạn 2, tuyến đường kết nối Bình Thuận cũ, cầu Vạn Thắng, khu dân cư KeraTi, khu dân cư Nam Duẩn, các dự án điện gió...): Giao Ban 1, Ban 2, Ban 3 khẩn trương rà soát kỹ thủ tục hồ sơ, tập trung giải quyết dứt điểm để đẩy nhanh tiến độ.",
        ],
      },
      {
        heading: "II. VỀ TRANG BỊ XE Ô TÔ CÔNG VỤ CẤP XÃ VÀ HỆ THỐNG CAMERA",
        paragraphs: [
          "Thống nhất chủ trương trang bị xe ô tô công vụ cho các xã, phường (dự kiến 140 xe) nhằm phục vụ kịp thời công tác tuần tra, kiểm soát an ninh trật tự và quản lý địa bàn cơ sở, nhất là các địa bàn miền núi có địa hình hiểm trở, độ dốc cao.",
          "Yêu cầu phương án lựa chọn xe: Ưu tiên dòng xe hai cầu bền bỉ, chi phí đầu tư hợp lý (khoảng 200 triệu đồng/xe hoặc theo đúng khung định mức tiết kiệm), phụ tùng thay thế phổ biến, thuận tiện bảo dưỡng và sửa chữa lâu dài.",
        ],
        items: [
          "Giao Sở Tài chính khẩn trương phối hợp với Sở Nội vụ, Công an tỉnh rà soát hiện trạng xe của 140 xã, phường; lập danh sách chi tiết các đơn vị còn thiếu và các xe đã hết niên hạn sử dụng để làm thủ tục thanh lý theo quy định.",
          "Sở Tài chính xây dựng phương án cân đối nguồn ngân sách, tính toán cụ thể để kịp thời bố trí mua sắm và điều chuyển phương tiện cho các xã còn thiếu.",
          "Về hệ thống camera an ninh: Thống nhất triển khai xử lý theo phương án đã được đồng chí Nghiên báo cáo; các đơn vị chuyên môn khẩn trương thực hiện bảo đảm kết nối thông suốt.",
        ],
      },
      {
        heading: "III. VỀ NGHĨA VỤ TÀI CHÍNH ĐẤT ĐAI, GIÁ ĐẤT VÀ XỬ LÝ CÔNG NỢ DỰ ÁN",
        paragraphs: [
          "Vấn đề xác định giá đất và xử lý nghĩa vụ tài chính đất đai là bài toán phức tạp, có nhiều vướng mắc lịch sử qua nhiều thời kỳ. Cơ quan chuyên môn phải làm việc cụ thể với từng doanh nghiệp, lập biên bản ghi nhận rõ ràng tình hình và các kiến nghị chính đáng.",
          "Ủy ban nhân dân tỉnh sẽ báo cáo, kiến nghị Bộ Tài chính xem xét cơ chế tháo gỡ đặc thù: Cho phép khoanh nợ nghĩa vụ tài chính đất đai, giãn tiến độ nộp tiền sử dụng đất và không tính lãi phạt chậm nộp trong thời gian chờ tháo gỡ thủ tục.",
        ],
        items: [
          "Về đề xuất cấn trừ công nợ của doanh nghiệp (doanh nghiệp đang nợ tiền đất 56 tỷ đồng nhưng đề nghị cấn trừ các khoản Nhà nước nợ lại): Quán triệt thực hiện nghiêm quy định quản lý tài chính, ngân sách - 'khoản nào ra khoản đó', không tùy tiện thực hiện bù trừ công nợ trái quy định pháp luật.",
          "Yêu cầu doanh nghiệp khẩn trương thực hiện nghĩa vụ nộp ngân sách số tiền 56 tỷ đồng. Đối với các khoản Nhà nước còn nợ doanh nghiệp hợp pháp, giao cơ quan tài chính khẩn trương rà soát hồ sơ thanh quyết toán để giải ngân, chi trả dứt điểm cho doanh nghiệp theo đúng trình tự.",
          "Giao các đơn vị phụ trách trực tiếp mời doanh nghiệp lên làm việc dứt điểm trong tuần tới để thống nhất phương án xử lý.",
        ],
      },
    ],
    chucVuNguoiKy: "KT. CHỦ TỊCH\nPHÓ CHỦ TỊCH",
    hoTenNguoiKy: "",
    noiNhan: [
      "Thường trực Tỉnh ủy (để b/c);",
      "Chủ tịch, các PCT UBND tỉnh;",
      "Các Sở: KH&ĐT, TC, TN&MT, XD, GTVT, NV;",
      "Công an tỉnh;",
      "UBND các huyện, thành phố;",
      "Các Ban QLDA chuyên ngành tỉnh;",
      "Lưu: VT, TH.",
    ],
  };

  const buffer = await renderAdminDocx(doc);
  const outPath = path.resolve("./Thong_bao_ket_luan_cuoc_hop_UBND_Thao_go_kho_khan_du_an.docx");
  fs.writeFileSync(outPath, buffer);
  console.log(`Đã tạo file Word thành công tại: ${outPath} (${buffer.length} bytes)`);

  console.log("=== 2. Đăng nhập Zalo API với account credentials ===");
  const api = await loginWithStoredCredentials(ACCOUNT_ID);

  console.log("=== 3. Gửi tóm tắt nội dung bóc băng âm thanh ===");
  const summaryMsg =
`🎙️ **BÁO CÁO KẾT QUẢ BÓC BĂNG & SOẠN THẢO VĂN BẢN TỪ FILE GHI ÂM (36 PHÚT 16 GIÂY)**

Dạ anh Châu, em đã hoàn thành việc lắng nghe toàn bộ file âm thanh "Bản ghi mới 11.m4a" và tổng hợp lại các nội dung chỉ đạo trọng tâm của cuộc họp Lãnh đạo UBND tỉnh:

1. **Tháo gỡ khó khăn cho các dự án đầu tư trọng điểm:**
- Phân công rõ trách nhiệm theo từng khối lĩnh vực: Du lịch, Nông nghiệp, Công nghiệp, Giao thông, Hạ tầng. Lãnh đạo phụ trách mảng nào chỉ đạo dứt điểm mảng đó.
- Giao đồng chí Hiệp (Tổ trưởng) chủ trì trực tiếp làm việc tháo gỡ vướng mắc cho các dự án; đồng chí Hải theo dõi, tổng hợp báo cáo Thường trực UBND tỉnh.
- Đẩy nhanh các dự án lớn: Quảng trường Trung tâm (giai đoạn 2), tuyến đường kết nối Bình Thuận cũ, cầu Vạn Thắng, khu dân cư KeraTi, Nam Duẩn, các dự án điện gió...

2. **Trang bị xe ô tô công vụ cấp xã & hệ thống camera:**
- Thống nhất chủ trương trang bị xe ô tô công vụ cho 140 xã, phường (ưu tiên xe 2 cầu chuyên dụng, bền bỉ, chi phí khoảng 200 triệu/xe theo định mức tiết kiệm, phụ tùng phổ thông dễ sửa chữa) phục vụ công tác tuần tra trật tự cơ sở.
- Giao Sở Tài chính phối hợp rà soát thanh lý xe hết niên hạn, cân đối ngân sách để mua sắm, bổ sung cho các xã còn thiếu.
- Triển khai xử lý, hoàn thiện hệ thống camera giám sát theo phương án của đ/c Nghiên.

3. **Tháo gỡ nghĩa vụ tài chính đất đai & xử lý công nợ dự án:**
- Báo cáo, kiến nghị Bộ Tài chính cho phép khoanh nợ tiền sử dụng đất, giãn tiến độ nộp và không tính lãi chậm nộp trong thời gian tháo gỡ khó khăn về giá đất.
- Về đề xuất cấn trừ nợ tiền đất 56 tỷ của doanh nghiệp: Quán triệt nguyên tắc quản lý tài chính "khoản nào ra khoản đó", không tùy tiện cấn trừ trái luật. Doanh nghiệp nộp tiền nợ ngân sách; các khoản Nhà nước nợ doanh nghiệp sẽ được khẩn trương nghiệm thu thanh quyết toán trả đúng trình tự. Mời doanh nghiệp làm việc dứt điểm tuần tới.

📄 *Em gửi kèm file văn bản Word chuẩn thể thức Nghị định 30/2020/NĐ-CP ngay bên dưới anh nhé!*`;

  await api.sendMessage({ msg: summaryMsg }, THREAD_ID, 0);
  console.log("Đã gửi tin nhắn tóm tắt thành công!");

  console.log("=== 4. Gửi đính kèm file Word (.docx) ===");
  await api.sendMessage(
    {
      msg: "📄 Văn bản: Thông báo Kết luận của Lãnh đạo UBND tỉnh về tháo gỡ khó khăn các dự án và triển khai nhiệm vụ trọng tâm (Chuẩn NĐ 30/2020/NĐ-CP)",
      attachments: [outPath],
    },
    THREAD_ID,
    0,
  );
  console.log("Đã gửi file Word đính kèm thành công!");
}

main().catch((err) => {
  console.error("Lỗi khi thực hiện:", err);
  process.exit(1);
});
