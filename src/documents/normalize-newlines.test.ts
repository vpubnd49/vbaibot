import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unescapeNewlinesDeep, explodeBlockLines, coBangGia } from "./normalize-newlines.js";

describe("normalize-newlines", () => {
  it("đổi chữ \\n thành xuống dòng thật, đệ quy", () => {
    const out = unescapeNewlinesDeep({ a: "CHI BỘ\\nBÍ THƯ", b: ["x\\ny"], n: 3 });
    assert.equal(out.a, "CHI BỘ\nBÍ THƯ");
    assert.equal(out.b[0], "x\ny");
    assert.equal(out.n, 3);
  });

  it("tách bullets và two_columns theo dòng, bỏ dòng rỗng", () => {
    const blocks = explodeBlockLines([
      { type: "bullets", items: ["a\nb"] },
      { type: "two_columns", left: ["L1\nL2"], right: ["R"] },
    ]) as any[];
    assert.deepEqual(blocks[0].items, ["a", "b"]);
    assert.deepEqual(blocks[1].left, ["L1", "L2"]);
  });

  it("nhận ra bảng giả dạng '1 | | | | nội dung' (đúng ca trong ảnh)", () => {
    assert.equal(coBangGia(["1 | | | | | | | Phê duyệt", "2 | | | | | | | Tài chính"]), true);
    assert.equal(coBangGia(["Một mục có | một dấu"]), false);
    assert.equal(coBangGia(undefined), false);
  });
});
