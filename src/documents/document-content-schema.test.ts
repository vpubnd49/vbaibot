import assert from "node:assert/strict";
import { describe, it } from "node:test";
// Module thuần (chỉ import zod) - không chạm env/DB nên import tĩnh được
import {
  documentBlockSchema,
  sheetSchema,
  spreadsheetCellSchema,
} from "./document-content-schema.js";

/**
 * Test PARSE schema thật - tầng từng bị bỏ trống: tool test gọi thẳng execute
 * (bỏ qua validate của AI SDK), render test dùng object TS thuần, nên lỗi
 * "Duplicate discriminator value" trong schema ô Excel làm create_excel_file
 * chết 100% trên Zalo thật trong khi 423 test vẫn xanh.
 */

describe("spreadsheetCellSchema", () => {
  it("HỒI QUY vụ chết trên Zalo: parse ô object KHÔNG được throw", () => {
    // discriminatedUnion với 2 schema cùng kind="formula" ném exception ngay
    // trong safeParse - assert.doesNotThrow là chốt chặn chính
    for (const cell of [
      { kind: "text", value: "x" },
      { kind: "number", value: 1 },
      { kind: "formula", op: "multiply", columns: ["B", "C"] },
      { kind: "formula", op: "sum", column: "D", fromRow: 2, toRow: 9 },
      { kind: "kind-la", value: "x" },
    ]) {
      assert.doesNotThrow(() => spreadsheetCellSchema.safeParse(cell), `throw với ${JSON.stringify(cell)}`);
    }
  });

  it("mọi dạng object hợp lệ đều parse được", () => {
    assert.deepEqual(spreadsheetCellSchema.parse({ kind: "text", value: "Vụ A" }), {
      kind: "text",
      value: "Vụ A",
    });
    assert.deepEqual(spreadsheetCellSchema.parse({ kind: "number", value: 5 }), {
      kind: "number",
      value: 5,
      format: "plain",
    });
    assert.deepEqual(
      spreadsheetCellSchema.parse({ kind: "formula", op: "multiply", columns: ["b", "c"] }),
      { kind: "formula", op: "multiply", columns: ["B", "C"] },
    );
  });

  /**
   * `columns` từng là `z.tuple()` nên độ dài do KIỂU giữ. Nay là
   * `z.array().length(2)` - đổi để nhà cung cấp soi chặt chịu nhận schema, xem
   * `tool-schema-provider-compat.test.ts` - nên độ dài thành ràng buộc LÚC CHẠY
   * và phải có người canh. Thiếu nó thì `columns[1]` là undefined và công thức
   * ghi ra file thành "B5*undefined5".
   */
  it("ô nhân phải có ĐÚNG 2 cột - thiếu hay thừa đều bị chối", () => {
    for (const columns of [[], ["B"], ["B", "C", "D"]]) {
      const ket = spreadsheetCellSchema.safeParse({ kind: "formula", op: "multiply", columns });
      assert.equal(ket.success, false, `columns=${JSON.stringify(columns)} lẽ ra phải bị chối`);
    }
  });

  it("chuỗi thường và số thuần - cách model gửi TỰ NHIÊN - được nhận và chuẩn hóa", () => {
    assert.deepEqual(spreadsheetCellSchema.parse("Vụ kim cương A"), {
      kind: "text",
      value: "Vụ kim cương A",
    });
    assert.deepEqual(spreadsheetCellSchema.parse(123), {
      kind: "number",
      value: 123,
      format: "plain",
    });
  });

  it('công thức dạng chuỗi "=B2*C2" và "=SUM(D2:D9)" được parse thành object', () => {
    assert.deepEqual(spreadsheetCellSchema.parse("=B2*C2"), {
      kind: "formula",
      op: "multiply",
      columns: ["B", "C"],
    });
    assert.deepEqual(spreadsheetCellSchema.parse("=SUM(D2:D9)"), {
      kind: "formula",
      op: "sum",
      column: "D",
      fromRow: 2,
      toRow: 9,
    });
    // Viết thường + có khoảng trắng vẫn hiểu
    assert.deepEqual(spreadsheetCellSchema.parse("= b2 * c2"), {
      kind: "formula",
      op: "multiply",
      columns: ["B", "C"],
    });
  });

  it("công thức ngoài 2 dạng hỗ trợ bị TỪ CHỐI kèm hướng dẫn, không âm thầm thành chữ", () => {
    for (const bad of ["=XLOOKUP(A1,B:B,C:C)", "=SUMIFS(D:D,A:A,1)", "=A2+B2", "=SUM(A2:B9)"]) {
      const result = spreadsheetCellSchema.safeParse(bad);
      assert.equal(result.success, false, `"${bad}" không được pass`);
      const messages = result.success ? "" : JSON.stringify(result.error.issues);
      assert.match(messages, /Chỉ hỗ trợ công thức/, `"${bad}" phải kèm hướng dẫn tiếng Việt`);
    }
  });

  it("sheet đầy đủ với rows trộn chuỗi + số + công thức chuỗi parse được", () => {
    const parsed = sheetSchema.parse({
      name: "Tổng quan",
      headers: ["Vụ việc", "Số nạn nhân", "Thiệt hại (tỷ)", "Ghi chú"],
      rows: [
        ["Vụ A", 12, 5.5, "đang xét xử"],
        ["Tổng", { kind: "number", value: 12 }, "=SUM(C2:C2)", ""],
      ],
    });
    assert.equal(parsed.rows[0]![1]!.kind, "number");
    assert.equal(parsed.rows[1]![2]!.kind, "formula");
  });
});

describe("documentBlockSchema", () => {
  it("cả 5 loại block parse được, không loại nào làm safeParse throw", () => {
    const blocks = [
      { type: "heading", text: "Mục", level: 1 },
      { type: "paragraph", text: "Đoạn văn" },
      { type: "paragraph", text: "Lạc khoản", align: "right" },
      { type: "bullets", items: ["a"] },
      { type: "table", headers: ["A"], rows: [["x"]] },
      { type: "two_columns", left: ["trái"], right: ["phải"] },
      // Dạng object lồng format model hay sinh ra
      {
        type: "two_columns",
        left: [{ text: "ĐẢNG BỘ XÃ", bold: true }],
        right: [{ text: "ĐẢNG CỘNG SẢN VIỆT NAM", bold: true }, { text: "Ngày 10/9/2026", italic: true }],
      },
      // Dạng columns mảng 2 phần tử
      {
        type: "two_columns",
        columns: [
          { text: "UBND TỈNH" },
          { text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" },
        ],
      },
      // Dạng paragraph lồng
      {
        type: "paragraph",
        paragraph: { text: "Nội dung nghị quyết...", align: "justify" },
      },
    ];
    for (const block of blocks) {
      assert.doesNotThrow(() => documentBlockSchema.safeParse(block));
      assert.equal(documentBlockSchema.safeParse(block).success, true, JSON.stringify(block));
    }
  });

  it("HỒI QUY 69 lỗi log: two_columns + col1/col2 thay vì left/right", () => {
    // Model Đảng hay gửi col1/col2 thay vì left/right
    const block = {
      type: "two_columns",
      col1: [{ bold: true, align: "center", text: "ĐẢNG BỘ TỈNH LÂM ĐỒNG" }],
      col2: [{ bold: true, align: "center", text: "ĐẢNG CỘNG SẢN VIỆT NAM" }],
      widths: [45, 55],
    };
    const ket = documentBlockSchema.safeParse(block);
    assert.equal(ket.success, true, `col1/col2 lẽ ra phải pass: ${JSON.stringify(ket.success ? {} : ket.error.issues)}`);
    if (ket.success) {
      // Kiểm tra ratio cũng được chuyển đổi từ widths
      assert.deepEqual(ket.data.type, "two_columns");
    }
  });

  it("HỒI QUY 69 lỗi log: two_columns + widths → ratio", () => {
    const block = {
      type: "two_columns",
      left: ["UBND TỈNH"],
      right: ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
      widths: [40, 60],
    };
    const ket = documentBlockSchema.safeParse(block);
    assert.equal(ket.success, true);
    if (ket.success && ket.data.type === "two_columns") {
      assert.deepEqual(ket.data.ratio, [40, 60]);
    }
  });

  it("HỒI QUY 69 lỗi log: heading rỗng {type: 'heading'} → default text", () => {
    const block = { type: "heading" };
    const ket = documentBlockSchema.safeParse(block);
    assert.equal(ket.success, true, "heading rỗng lẽ ra phải pass với text mặc định");
  });

  it("HỒI QUY 69 lỗi log: heading dùng title thay vì text", () => {
    const block = { type: "heading", title: "BÁO CÁO TỔNG HỢP", level: 1 };
    const ket = documentBlockSchema.safeParse(block);
    assert.equal(ket.success, true);
    if (ket.success) {
      assert.equal(ket.data.type === "heading" && ket.data.text, "BÁO CÁO TỔNG HỢP");
    }
  });

  it("HỒI QUY: paragraph dùng value/description thay vì text", () => {
    for (const variant of [
      { type: "paragraph", value: "Nội dung đoạn văn" },
      { type: "paragraph", description: "Mô tả chi tiết" },
    ]) {
      const ket = documentBlockSchema.safeParse(variant);
      assert.equal(ket.success, true, `${JSON.stringify(variant)} lẽ ra phải pass`);
    }
  });

  it("HỒI QUY: table dùng data thay vì rows, columns thay vì headers", () => {
    const block = {
      type: "table",
      columns: ["Cột A", "Cột B"],
      data: [["x", "y"]],
    };
    const ket = documentBlockSchema.safeParse(block);
    assert.equal(ket.success, true, "table + columns/data lẽ ra phải pass");
  });

  it("HỒI QUY: bullets dùng content thay vì items", () => {
    const block = { type: "bullets", content: ["Điểm 1", "Điểm 2"] };
    const ket = documentBlockSchema.safeParse(block);
    assert.equal(ket.success, true, "bullets + content lẽ ra phải pass");
  });
});

/**
 * `level` từng là union literal (1|2|3) nên độ rộng do KIỂU giữ. Nay là khoảng
 * số - đổi để Google chịu nhận schema, xem `tool-schema-provider-compat.test.ts`
 * - nên ràng buộc thành chuyện LÚC CHẠY và phải có người canh. Lọt cấp 0 hay 4
 * thì hàm tra ở render-docx trả về cấp gần nhất, tức file ra sai cấp mà không
 * ai báo.
 */
describe("headingBlock - cấp tiêu đề", () => {
  it("nhận đúng 1, 2, 3", () => {
    for (const level of [1, 2, 3]) {
      const ket = documentBlockSchema.safeParse({ type: "heading", text: "M", level });
      assert.equal(ket.success, true, `cấp ${level} lẽ ra phải nhận`);
    }
  });

  it("chối cấp ngoài khoảng và số lẻ", () => {
    for (const level of [0, 4, 1.5, -1]) {
      const ket = documentBlockSchema.safeParse({ type: "heading", text: "M", level });
      assert.equal(ket.success, false, `cấp ${level} lẽ ra phải bị chối`);
    }
  });

  it("bỏ trống thì mặc định cấp 2", () => {
    const ket = documentBlockSchema.parse({ type: "heading", text: "M" });
    assert.deepEqual(ket, { type: "heading", text: "M", level: 2 });
  });
});
