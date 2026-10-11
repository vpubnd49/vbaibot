import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePassStatus, type PassEvidence } from "./pass-status-rules.js";
import { scrubPassClaims } from "./pass-claim-scrubber.js";

const ev = (title: string, iso: string): PassEvidence => ({
  title,
  source: "Báo",
  publishedAt: new Date(iso),
  link: "",
  snippet: "",
});

describe("computePassStatus", () => {
  it("không có tin → ⚪, không khẳng định thông suốt", () => {
    const st = computePassStatus([], 14);
    assert.equal(st.icon, "⚪");
    assert.match(st.lines.join(" "), /Chưa có thông tin/);
  });

  it("Gia Bắc: tin thông tuyến mới hơn KHÔNG xoá lệnh cấm xe sửa chữa cũ", () => {
    const st = computePassStatus(
      [
        ev("Đèo Gia Bắc thông tuyến sau sạt lở", "2026-10-09T08:00:00Z"),
        ev("Xuyên đêm xử lý sạt lở, cây rừng ngã đổ trên đèo Gia Bắc", "2026-10-09T03:00:00Z"),
        ev("Cấm xe qua lại đèo Gia Bắc để tập trung sửa chữa", "2026-09-30T07:00:00Z"),
      ],
      14,
    );
    assert.equal(st.icon, "🟡");
    const text = st.lines.join(" ");
    assert.match(text, /Cấm xe qua lại đèo Gia Bắc/);
    assert.match(text, /CHƯA thấy tin dỡ bỏ/);
    assert.match(text, /cần thận trọng/);
  });

  it("lệnh cấm có tin dỡ bỏ sau đó → không còn cảnh báo", () => {
    const st = computePassStatus(
      [
        ev("Dỡ bỏ lệnh cấm xe qua đèo Gia Bắc", "2026-10-10T08:00:00Z"),
        ev("Cấm xe qua lại đèo Gia Bắc để sửa chữa", "2026-09-30T07:00:00Z"),
      ],
      14,
    );
    assert.doesNotMatch(st.lines.join(" "), /CHƯA thấy tin dỡ bỏ/);
  });

  it("tin mới nhất là cấm xe → 🔴", () => {
    const st = computePassStatus([ev("Cấm xe qua đèo Prenn từ hôm nay", "2026-10-11T01:00:00Z")], 14);
    assert.equal(st.icon, "🔴");
  });

  it("có thi công/khắc phục → 🟡, không bao giờ 🟢", () => {
    const st = computePassStatus([ev("Lâm Đồng chi 16 tỷ đồng khắc phục sạt lở đèo Prenn", "2026-10-09T03:00:00Z")], 14);
    assert.equal(st.icon, "🟡");
  });
});

describe("scrubPassClaims", () => {
  it("gỡ câu 'lưu thông bình thường' ở dòng về đèo, giữ phần cảnh báo", () => {
    const input = [
      "5. 🟡 **Đèo Prenn (QL20):**",
      "- Tỉnh bố trí 16 tỷ đồng khắc phục sạt lở (09/10). Phương tiện lưu thông bình thường nhưng cần chú ý rào chắn thi công.",
    ].join("\n");
    const out = scrubPassClaims(input);
    assert.doesNotMatch(out, /lưu thông bình thường/);
    assert.match(out, /16 tỷ đồng/);
    assert.match(out, /cần chú ý rào chắn/i);
    assert.doesNotMatch(out, /\. nhưng/);
  });

  it("gỡ 'thông suốt' trên dòng đèo", () => {
    const out = scrubPassClaims("2. Đèo Mimosa: 🟢 Thông suốt — mặt đường êm thuận.");
    assert.doesNotMatch(out, /thông suốt|êm thuận/i);
  });

  it("không đụng dòng không nói về đèo", () => {
    const line = "Hồ Đa Nhim vận hành ổn định, giao thông thuận lợi trong nội thị.";
    assert.equal(scrubPassClaims(line), line);
  });

  it("giữ câu phủ định 'chưa thể lưu thông'", () => {
    const line = "Đèo Gia Bắc: chưa thể lưu thông bình thường do đang sửa chữa.";
    assert.match(scrubPassClaims(line), /chưa thể lưu thông/);
  });
});
