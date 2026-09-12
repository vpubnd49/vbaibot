import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listProvinces,
  searchAdministrativeUnit,
  getCommunesByProvince,
  getStats,
} from "./admin-division-service.js";

test("Admin division service: tra cứu 34 tỉnh và mô hình 2 cấp", () => {
  const stats = getStats();
  assert.equal(stats.totalProvinces, 34);

  const provinces = listProvinces();
  assert.equal(provinces.length, 34);

  // Kiểm tra tìm kiếm tỉnh
  const haNoiSearch = searchAdministrativeUnit("Hà Nội");
  assert.ok(haNoiSearch.provinces.length > 0);
  assert.equal(haNoiSearch.provinces[0]!.name, "Thành phố Hà Nội");

  // Kiểm tra tìm kiếm không dấu
  const lamDongSearch = searchAdministrativeUnit("lam dong");
  assert.ok(lamDongSearch.provinces.length > 0);
  assert.equal(lamDongSearch.provinces[0]!.name, "Tỉnh Lâm Đồng");

  // Lấy xã phường theo tỉnh
  const ldCommunes = getCommunesByProvince("34");
  assert.ok(Array.isArray(ldCommunes) && ldCommunes.length > 0);

  // Lâm Đồng mới hợp nhất Lâm Đồng cũ + Bình Thuận + Đắk Nông.
  // Đắk Lắk là tỉnh độc lập, không được trả nhầm về Lâm Đồng.
  const binhThuan = searchAdministrativeUnit("Bình Thuận");
  assert.equal(binhThuan.provinces[0]!.name, "Tỉnh Lâm Đồng");
  const dakNong = searchAdministrativeUnit("Đắk Nông");
  assert.equal(dakNong.provinces[0]!.name, "Tỉnh Lâm Đồng");
  const dakLak = searchAdministrativeUnit("Đắk Lắk");
  assert.equal(dakLak.provinces[0]!.name, "Tỉnh Đắk Lắk");
  assert.ok(!dakLak.provinces.some((p) => p.name === "Tỉnh Lâm Đồng"));
});
