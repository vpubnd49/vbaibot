import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAdminDocx } from "./render-admin-docx.js";
import { renderPartyDocx } from "./render-party-docx.js";
import type { AdminDocument } from "./admin-document-schema.js";

describe("renderAdminDocx (Nghị định 30/2020/NĐ-CP)", () => {
  it("sinh Buffer hợp lệ cho Tờ trình chuẩn NĐ 30", async () => {
    const toTrinhDoc: AdminDocument = {
      heThong: "nha_nuoc_nd30",
      loaiVanBan: "to_trinh",
      coQuanCapTren: "UBND TỈNH LÂM ĐỒNG",
      coQuanBanHanh: "SỞ KHOA HỌC VÀ CÔNG NGHỆ",
      soKyHieu: "Số:       /TTr-SKHCN",
      diaDanh: "Lâm Đồng",
      ngay: "25",
      thang: "08",
      nam: "2026",
      trichYeu: "Về việc phê duyệt dự toán nhiệm vụ chuẩn bị đầu tư dự án trang thiết bị",
      kinhGui: ["Ủy ban nhân dân tỉnh Lâm Đồng", "Sở Tài chính tỉnh Lâm Đồng"],
      canCuPhapLy: [
        "Căn cứ Luật Công nghệ thông tin ngày 29 tháng 6 năm 2006;",
        "Căn cứ Luật Đầu tư công ngày 29 tháng 11 năm 2024;",
        "Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư.",
      ],
      sections: [
        {
          heading: "I. SỰ CẦN THIẾT ĐẦU TƯ",
          paragraphs: [
            "Nhằm nâng cao hiệu quả công tác chỉ đạo điều hành của Ủy ban nhân dân cấp xã và đẩy nhanh tiến độ triển khai Đề án 06.",
            "Hiện trạng trang thiết bị công nghệ thông tin tại các địa phương còn thiếu và lạc hậu.",
          ],
          items: [
            "Trang bị máy tính làm việc cho bộ phận Một cửa",
            "Nâng cấp đường truyền mạng số liệu chuyên dùng",
          ],
        },
        {
          heading: "II. KIẾN NGHỊ VÀ ĐỀ XUẤT",
          paragraphs: [
            "Kính trình Ủy ban nhân dân tỉnh xem xét, phê duyệt dự toán nhiệm vụ chuẩn bị đầu tư với tổng kinh phí là 500.000.000 đồng.",
          ],
          table: {
            headers: ["STT", "Hạng mục", "Kinh phí dự kiến (VNĐ)", "Ghi chú"],
            rows: [
              ["1", "Khảo sát hiện trạng", "50.000.000", "Theo định mức"],
              ["2", "Lập đề cương chi tiết", "450.000.000", "Bao gồm dự toán"],
            ],
          },
        },
      ],
      chucVuNguoiKy: "GIÁM ĐỐC",
      hoTenNguoiKy: "Nguyễn Văn A",
      noiNhan: ["Như kính gửi", "Chủ tịch UBND tỉnh", "Lưu: VT, KHTC (02b)"],
    };

    const buffer = await renderAdminDocx(toTrinhDoc);
    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 5000, "File docx sinh ra phải có kích thước hợp lệ");
  });

  it("sinh Buffer hợp lệ cho Công văn không có tên loại văn bản", async () => {
    const congVanDoc: AdminDocument = {
      heThong: "nha_nuoc_nd30",
      loaiVanBan: "cong_van",
      coQuanCapTren: "UBND TỈNH LÂM ĐỒNG",
      coQuanBanHanh: "VĂN PHÒNG",
      soKyHieu: "Số: 1234/VP-NC",
      diaDanh: "Lâm Đồng",
      ngay: "25",
      thang: "08",
      nam: "2026",
      trichYeu: "V/v triển khai chỉ đạo của Chủ tịch UBND tỉnh về công tác cải cách hành chính",
      kinhGui: ["Giám đốc các Sở, ban, ngành", "Chủ tịch UBND các huyện, thành phố"],
      sections: [
        {
          paragraphs: [
            "Thực hiện ý kiến chỉ đạo của Chủ tịch Ủy ban nhân dân tỉnh tại Thông báo số 123/TB-UBND, Văn phòng UBND tỉnh đề nghị các đơn vị khẩn trương thực hiện các nội dung sau:",
          ],
          items: [
            "Rà soát toàn bộ thủ tục hành chính thuộc thẩm quyền giải quyết",
            "Đẩy mạnh thanh toán trực tuyến trên Cổng Dịch vụ công quốc gia",
          ],
        },
      ],
      chucVuNguoiKy: "CHÁNH VĂN PHÒNG",
      hoTenNguoiKy: "Trần Văn B",
      noiNhan: ["Như trên", "Chủ tịch UBND tỉnh (b/c)", "Lưu: VT, NC"],
    };

    const buffer = await renderAdminDocx(congVanDoc);
    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 4000);
  });
});

describe("renderPartyDocx (Hướng dẫn 05-HD/VPTW)", () => {
  it("sinh Buffer hợp lệ cho Quyết định/Nghị quyết Đảng chuẩn HD 05", async () => {
    const partyDoc: AdminDocument = {
      heThong: "dang_hd05",
      loaiVanBan: "nghi_quyet",
      coQuanCapTren: "TỈNH ỦY LÂM ĐỒNG",
      coQuanBanHanh: "BAN THƯỜNG VỤ",
      soKyHieu: "Số: 15-NQ/TU",
      diaDanh: "Lâm Đồng",
      ngay: "25",
      thang: "08",
      nam: "2026",
      trichYeu: "về tăng cường sự lãnh đạo của Đảng đối với công tác chuyển đổi số",
      canCuPhapLy: [
        "Căn cứ Điều lệ Đảng Cộng sản Việt Nam;",
        "Căn cứ Quy chế làm việc của Ban Chấp hành Đảng bộ tỉnh khóa XI,",
      ],
      sections: [
        {
          heading: "I. TÌNH HÌNH VÀ NGUYÊN NHÂN",
          paragraphs: [
            "Trong thời gian qua, các cấp ủy đảng, chính quyền đã tích cực lãnh đạo, chỉ đạo triển khai ứng dụng công nghệ thông tin và chuyển đổi số đạt nhiều kết quả quan trọng.",
          ],
        },
        {
          heading: "II. MỤC TIÊU VÀ NHIỆM VỤ GIẢI PHÁP",
          paragraphs: [
            "Phát triển chính quyền số, kinh tế số và xã hội số toàn diện, lấy người dân và doanh nghiệp làm trung tâm phục vụ.",
          ],
          items: [
            "Nâng cao nhận thức và trách nhiệm của người đứng đầu cấp ủy",
            "Đầu tư hạ tầng số đồng bộ và an toàn thông tin",
          ],
        },
      ],
      chucVuNguoiKy: "T/M BAN THƯỜNG VỤ\nBÍ THƯ",
      hoTenNguoiKy: "Nguyễn Văn C",
      noiNhan: ["Các đảng bộ trực thuộc", "Các ban tham mưu Tỉnh ủy", "Lưu: VP Tỉnh ủy."],
    };

    const buffer = await renderPartyDocx(partyDoc);
    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 5000);
  });
});
