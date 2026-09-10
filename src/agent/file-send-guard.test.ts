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
