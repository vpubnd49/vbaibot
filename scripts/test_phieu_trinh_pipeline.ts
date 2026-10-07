import fs from "fs";
import path from "path";
import { renderAdminDocx } from "../src/documents/render-admin-docx.js";
import type { AdminDocument } from "../src/documents/admin-document-schema.js";

async function run() {
  const sampleDoc: AdminDocument = {
    heThong: "nha_nuoc_nd30",
    loaiVanBan: "phieu_trinh",
    coQuanCapTren: "UBND TỈNH LÂM ĐỒNG",
    coQuanBanHanh: "VĂN PHÒNG",
    soKyHieu: "Số: 559/PT-NC",
    diaDanh: "Lâm Đồng",
    nam: "2026",
    trichYeu: "Về nội dung liên quan đến Công văn số 16064/UBND-NC của UBND tỉnh",
    kinhGui: ["Lãnh đạo UBND tỉnh;", "Lãnh đạo Văn phòng UBND tỉnh."],
    sections: [
      {
        heading: "I. NỘI DUNG TRÌNH/CHỈ ĐẠO",
        paragraphs: [
          "1. Văn bản/cơ quan, đơn vị: Báo cáo số 559/BC-STP ngày 10 tháng 10 năm 2026 của Sở Tư pháp và Công văn số 2182/BQLDA3-KHTĐ ngày 29/9/2026 của Ban Quản lý dự án đầu tư xây dựng số 3.",
          "2. Trích yếu: Về nội dung liên quan đến Công văn số 16064/UBND-NC ngày 23/9/2026 của UBND tỉnh về việc xử lý Tờ trình số 245/TTr-STP của Sở Tư pháp (ban hành Quyết định quy định danh mục văn bản quy định chi tiết và nội dung được giao).",
        ],
      },
      {
        heading: "II. RÀ SOÁT, TỔNG HỢP CỦA PHÒNG CHUYÊN MÔN THUỘC VĂN PHÒNG",
        paragraphs: [
          "1. Lưu ý thêm (Rà soát cần phải xin ý kiến các cơ quan thì đánh dấu X vào ô tương ứng):",
          "[X] Văn bản của cơ quan trình    [] Bộ, ngành Trung ương",
          "[] Quy chế làm việc của Tỉnh ủy  [] HĐND tỉnh",
          "[] Quy chế làm việc của Đảng ủy UBND tỉnh  [] Cơ quan khác",
          "[X] Quy chế làm việc của UBND tỉnh",
          "2. Các sở, ban, ngành, đơn vị, địa phương trình (kết quả đề nghị): Sở Tư pháp.",
          "3. Thẩm quyền (Chọn ghi thẩm quyền tương ứng): Chủ tịch Ủy ban nhân dân tỉnh.",
          "4. Phòng chuyên môn của Văn phòng UBND tỉnh đề xuất phương án: Lĩnh vực xây dựng, quy hoạch và ban hành văn bản quy phạm pháp luật do Phó Chủ tịch UBND tỉnh phụ trách. Căn cứ chức năng, nhiệm vụ, lĩnh vực phụ trách và kết quả rà soát Báo cáo số 559/BC-STP của Sở Tư pháp, Công văn số 2182/BQLDA3-KHTĐ của Ban Quản lý dự án ĐTXD số 3, Phòng Nội chính nhận thấy việc Sở Tư pháp đề xuất giao Ban Quản lý dự án ĐTXD số 1, số 2, số 3 là cơ quan chủ trì soạn thảo văn bản quy phạm pháp luật là CHƯA PHÙ HỢP. Giao Sở Xây dựng là cơ quan chủ trì soạn thảo.",
          "4.1. Thống nhất hoàn toàn   [ ]",
          "4.2. Thống nhất              [ ]  Sửa: ..................................................................................................................",
          "4.3. Không thống nhất        [ ]  Lý do: ...............................................................................................................",
          "5. Độ mật: Không.",
          "PHÒNG XỬ LÝ CHÍNH: NỘI CHÍNH",
          "Thạch Cảnh Minh Vũ",
          "Chuyên viên Ngày 07 tháng 10 năm 2026",
          "Trương Hải Châu",
          "Lãnh đạo phòng Ngày 07 tháng 10 năm 2026",
          "Nguyễn Tuấn Anh",
          "LÃNH ĐẠO VĂN PHÒNG",
          "Ý KIẾN CỦA PHÓ CHỦ TỊCH UBND TỈNH",
          "Ngày ..... tháng 10 năm 2026",
          "Nguyễn Ngọc Phúc",
          "CHỦ TỊCH UBND TỈNH",
          "Ngày ..... tháng 10 năm 2026",
          "Trần Hồng Thái",
        ],
      },
    ],
    chucVuNguoiKy: "Chuyên viên",
    hoTenNguoiKy: "Thạch Cảnh Minh Vũ",
    noiNhan: ["Như trên", "Lưu: VT, NC"],
  };

  console.log("Rendering phieu_trinh via renderAdminDocx...");
  const buf = await renderAdminDocx(sampleDoc);
  const outPath = path.resolve("scripts/test_pipeline_phieu_trinh_result.docx");
  fs.writeFileSync(outPath, buf);
  console.log("✅ Render thành công file:", outPath, `(${buf.length} bytes)`);
}

run().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});
