import test from "node:test";
import assert from "node:assert/strict";
import { BANG_DINH_TUYEN, khoiDinhTuyen } from "./persona-tool-routing.js";
import { TOOL_KEYS } from "./tools/tool-registry.js";

test("mọi tool trong bảng định tuyến có thật trong registry", () => {
  const keys = new Set<string>(TOOL_KEYS as readonly string[]);
  for (const d of BANG_DINH_TUYEN) assert.ok(keys.has(d.tool), `tool lạ: ${d.tool}`);
});

test("chỉ liệt kê tool đang bật, không nhắc tool tắt", () => {
  const khoi = khoiDinhTuyen(new Set(["create_word_document", "convert_file"]))!;
  assert.match(khoi, /create_word_document/);
  assert.match(khoi, /convert_file/);
  assert.doesNotMatch(khoi, /create_admin_document/);
});

test("dưới 2 tool thì không cần bảng chọn", () => {
  assert.equal(khoiDinhTuyen(new Set(["create_word_document"])), null);
  assert.equal(khoiDinhTuyen(new Set()), null);
});
