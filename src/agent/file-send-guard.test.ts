import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  laTinNhanAoGiacGuiFile,
  taoTinNhanNhacGoiTool,
  xoaNhanAoGiacGuiFile,
} from "./file-send-guard.js";

describe("file-send-guard", () => {
  describe("laTinNhanAoGiacGuiFile", () => {
    it("trả về false nếu đã gọi tool tạo/gửi file hợp lệ", () => {
      const text =
        'Dạ anh Tran, em đã chuyển nội dung sang file Excel. [đã gửi file: danh_sach.xlsx]';
      const calls = ["create_excel_file"];
      assert.equal(laTinNhanAoGiacGuiFile(text, calls), false);
    });

    it("bắt được ca model tự gõ [đã gửi file: ...] khi calls rỗng", () => {
      const text =
        'Dạ anh Tran, em đã chuyển nội dung bảng "Danh sách kênh thông tin của cơ sở giáo dục" từ file PDF sang file Excel để anh tiện nhập liệu và quản lý. [đã gửi file: Danh_sach_kenh_thong_tin_co_so_giao_duc.xlsx]\n\nEm đã thiết lập file...';
      const calls: string[] = [];
      assert.equal(laTinNhanAoGiacGuiFile(text, calls), true);
    });

    it("bắt được ca model tự gõ [đã gửi ảnh] hoặc [đã gửi video AI] khi không gọi tool", () => {
      const text = "Dạ đây là ảnh em vừa vẽ cho anh [đã gửi ảnh]";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt được câu 'em đã chuyển nội dung sang file Excel' khi calls rỗng", () => {
      const text = "Dạ anh, em đã chuyển toàn bộ nội dung sang file Excel để anh theo dõi.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt được câu 'em gửi anh file Excel' khi calls rỗng", () => {
      const text = "Dạ em gửi anh file Excel báo cáo tiến độ công việc.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt được câu 'em đang xuất file cho anh' khi calls rỗng", () => {
      const text = "Dạ em đang xuất file Danh mục thi hành án cho anh đây ạ.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt được ca người dùng yêu cầu 'chuyển qua file excel giúp tôi' và model mô tả file nhưng không gọi tool", () => {
      const userPrompt = "chuyển qua file excel giúp tôi";
      const botText = "Em đã thiết lập file với các đặc điểm: Cột 1 STT, Cột 2 Tên đơn vị...";
      assert.equal(laTinNhanAoGiacGuiFile(botText, [], userPrompt), true);
    });

    it("trả về false cho hội thoại thông thường không liên quan đến gửi file", () => {
      const text = "Theo quy định tại Nghị định 30/2020/NĐ-CP thì phông chữ sử dụng là Times New Roman.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), false);
    });

    // ── Hồi quy cho các lỗ hổng regex phát hiện ngày 10/09/2026 ──

    it("bắt 'đang thực hiện lệnh xuất file Excel ngay lúc này' — không cần 'cho anh'", () => {
      const text = "Em đang thực hiện lệnh xuất file Excel ngay lúc này.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt 'em đã xuất file cho anh rồi' — dùng 'xuất' thay 'gửi'", () => {
      const text = "Dạ em đã xuất file Excel báo cáo tổng hợp cho anh rồi ạ.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt 'Đang thực hiện xuất file excel cho anh Châu' — tên riêng sau 'anh'", () => {
      const text = "Đang thực hiện xuất file excel cho anh Châu đây ạ.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt khi user yêu cầu 'tiến hành xuất' và model mô tả nội dung file", () => {
      const userPrompt = "tiến hành xuất";
      const botText = "Em đã xuất nội dung bảng thi hành án vào file Excel gồm 11 dòng...";
      assert.equal(laTinNhanAoGiacGuiFile(botText, [], userPrompt), true);
    });

    it("bắt khi user yêu cầu 'tiến hành xuất cho tôi' và model mô tả file", () => {
      const userPrompt = "tiến hành xuất cho tôi";
      const botText = "Em đang xuất nội dung file tài liệu thành Excel cho anh ạ.";
      assert.equal(laTinNhanAoGiacGuiFile(botText, [], userPrompt), true);
    });

    // ── Hồi quy vụ 12/09/2026: 'tổng hợp xuất bảng biểu' & 'Em tiến hành gọi tool xuất file' ──

    it("bắt câu 'Em tiến hành gọi tool xuất file Excel cho anh ngay đây ạ!' khi không gọi tool", () => {
      const text = "Em tiến hành gọi tool xuất file Excel cho anh ngay đây ạ!";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt câu 'em sẽ xuất một **File Excel Quản lý Tiến độ** chuyên nghiệp' có markdown bold", () => {
      const text = "Dạ anh Châu, em sẽ thực hiện ngay. Em sẽ xuất một **File Excel Quản lý Tiến độ** chuyên nghiệp.";
      assert.equal(laTinNhanAoGiacGuiFile(text, []), true);
    });

    it("bắt ca người dùng yêu cầu 'tổng hợp xuất bảng biểu' và bot mô tả cấu trúc các Sheet nhưng không gọi tool", () => {
      const userPrompt = "tổng hợp xuất bảng biểu";
      const botText = `Dạ anh Châu, em sẽ thực hiện ngay. Để biến nội dung kết luận thành công cụ quản lý thực tế, em sẽ xuất một **File Excel Quản lý Tiến độ** chuyên nghiệp.

Thay vì chỉ là một bảng liệt kê, em thiết kế file này thành một hệ thống theo dõi (Tracking System) để Công an tỉnh có thể dùng làm mẫu yêu cầu các Sở, Ngành báo cáo.

**Cấu trúc File Excel em sẽ xuất:**

1. **Sheet "Tổng hợp báo cáo":**
- Bảng thống kê số lượng nhiệm vụ: **Đã hoàn thành** | **Trễ hạn** | **Chưa hoàn thành**.
- Phân loại lý do trễ: Chủ quan | Phụ thuộc Trung ương.

2. **Sheet "Chi tiết 60 Nhiệm vụ":**
- Cột thông tin: STT | Tên nhiệm vụ | Sở/Ngành chủ trì | Hạn định (30/11).

Em tiến hành gọi tool xuất file Excel cho anh ngay đây ạ!`;
      assert.equal(laTinNhanAoGiacGuiFile(botText, [], userPrompt), true);
    });
  });

  describe("xoaNhanAoGiacGuiFile", () => {
    it("xóa sạch nhãn giả mạo [đã gửi file: ...] trong văn bản", () => {
      const text =
        "Dạ anh Tran, em đã tổng hợp nội dung. [đã gửi file: bao-cao.xlsx]\n\nAnh xem qua nhé!";
      const cleaned = xoaNhanAoGiacGuiFile(text);
      assert.ok(!cleaned.includes("[đã gửi file: bao-cao.xlsx]"));
      assert.ok(cleaned.includes("Dạ anh Tran, em đã tổng hợp nội dung."));
      assert.ok(cleaned.includes("Anh xem qua nhé!"));
    });
  });

  describe("taoTinNhanNhacGoiTool", () => {
    it("sinh thông điệp cảnh báo rõ ràng yêu cầu gọi tool", () => {
      const msg = taoTinNhanNhacGoiTool();
      assert.ok(msg.includes("CẢNH BÁO"));
      assert.ok(msg.includes("create_excel_file"));
    });
  });
});
