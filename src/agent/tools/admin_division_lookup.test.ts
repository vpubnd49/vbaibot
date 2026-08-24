import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAdminDivisionData,
  searchAdminDivisions,
  createAdminDivisionLookupTool,
} from "./admin_division_lookup.js";

describe("admin_division_lookup tool", () => {
  it("nạp dữ liệu 34 tỉnh vào RAM Cache thành công", () => {
    const data = getAdminDivisionData();
    assert.ok(data.provinces.length >= 34, "Phải nạp đủ 34 tỉnh/thành phố");
  });

  it("tra cứu tỉnh theo tiếng Việt có dấu và không dấu", () => {
    const res1 = searchAdminDivisions("Lâm Đồng");
    assert.ok(res1.provinces.some((p) => p.name.includes("Lâm Đồng")));

    const res2 = searchAdminDivisions("lam dong");
    assert.ok(res2.provinces.some((p) => p.name.includes("Lâm Đồng")));
  });

  it("tra cứu ngược theo tên huyện/quận cũ trước sáp nhập", () => {
    const res = searchAdminDivisions("Tánh Linh");
    assert.ok(
      res.communes.some((c) => c.oldDistrict?.includes("Tánh Linh") || c.name.includes("Tánh Linh")),
      "Phải tìm thấy xã thuộc huyện Tánh Linh cũ",
    );
  });

  it("tra cứu đặc khu huyện đảo (Phú Quý, Cát Hải, Vân Đồn, Hoàng Sa)", () => {
    const resPhuQuy = searchAdminDivisions("Phú Quý");
    assert.ok(resPhuQuy.communes.some((c) => c.name.includes("Phú Quý") && c.type === "dac_khu"));

    const resVanDon = searchAdminDivisions("van don");
    assert.ok(resVanDon.communes.some((c) => c.name.includes("Vân Đồn") && c.type === "dac_khu"));
  });

  it("tra cứu sáp nhập tỉnh cũ (Hà Tây, Bình Thuận, Đắk Nông, Hà Giang)", () => {
    const resBinhThuan = searchAdminDivisions("Bình Thuận");
    assert.ok(
      resBinhThuan.provinces.some((p) => p.name.includes("Lâm Đồng")),
      "Bình Thuận phải trả về tỉnh Lâm Đồng mới",
    );
  });

  it("tool execute trả về định dạng markdown mô hình 2 cấp rõ ràng", async () => {
    const tool = createAdminDivisionLookupTool();
    const result = await tool.execute({ query: "Tánh Linh" }, {} as any);
    assert.match(String(result), /Chính quyền địa phương 02 cấp/);
    assert.match(String(result), /Lâm Đồng/);
  });
});
