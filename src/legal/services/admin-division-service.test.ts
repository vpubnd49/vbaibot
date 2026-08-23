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
  const ldCommunes = getCommunesByProvince("68");
  assert.ok(Array.isArray(ldCommunes));
});
