import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickIndex, listChoices } from "./recent-file-picker.js";

const paths = [
  "media/a/t/1-0.jpg",
  "media/a/t/2-0.jpg",
  "media/a/t/3-file-0-M__u_b_o_c_o.docx",
];
const names = new Map([[paths[2]!, "Mẫu báo cáo tuần.docx"]]);

describe("recent-file-picker", () => {
  it("khớp tên gốc có dấu bằng từ khóa không dấu - đúng ca đọc nhầm ảnh thay vì file mẫu", () => {
    assert.deepEqual(pickIndex(paths, names, 0, "mau bao cao"), { index: 2 });
    assert.deepEqual(pickIndex(paths, names, 0, "MẪU"), { index: 2 });
  });

  it("không có fileName thì dùng fileIndex", () => {
    assert.deepEqual(pickIndex(paths, names, 1), { index: 1 });
  });

  it("không khớp tên thì báo kèm danh sách file hiện có, không đoán bừa", () => {
    const r = pickIndex(paths, names, 0, "quyết định");
    assert.ok("error" in r && r.error.includes("Mẫu báo cáo tuần.docx"));
  });

  it("fileIndex quá giới hạn cũng liệt kê file", () => {
    const r = pickIndex(paths, names, 9);
    assert.ok("error" in r && r.error.includes("2: Mẫu báo cáo tuần.docx"));
  });

  it("listChoices rút gọn khi quá nhiều file", () => {
    const many = Array.from({ length: 15 }, (_, i) => `f${i}.pdf`);
    assert.match(listChoices(many, new Map()), /và 5 file cũ hơn/);
  });
});
