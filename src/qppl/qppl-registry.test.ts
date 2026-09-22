import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePortalUrl, resolveAgency, LAMDONG_PORTAL_MAPPINGS } from "./qppl-registry.js";

describe("qppl-registry portal mappings", () => {
  const TEST_URLS = [
    "https://lamdong.gov.vn/sites/qppl/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/qppl/nghi-quyet/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/qppl/quyet-dinh/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/the-loai/toan-bo/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/the-loai/quyet-dinh/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/dbnd/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/vpubnd/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/bqlkhucn/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/bqlgt/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/socongthuong/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/bandantoc/SitePages/Home.aspx",
    "https://lamdong.edu.vn/vi/sgd-van-ban/?param=sgd_document",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/skhcn/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/snv/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/snnptnt/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/sngv/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/stc/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/stp/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/svhttdl/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/sxd/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/syt/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/thanh-tra-tinh/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/the-loai/toan-bo/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/the-loai/quyet-dinh/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/qppl/nghi-quyet/SitePages/Home.aspx",
    "https://lamdong.gov.vn/sites/qppl/qppl/quyet-dinh/SitePages/Home.aspx",
  ];

  it("phân giải đầy đủ và chính xác tất cả 26 URLs do người dùng cung cấp", () => {
    assert.ok(LAMDONG_PORTAL_MAPPINGS.length >= 22);
    for (const url of TEST_URLS) {
      const resolved = resolvePortalUrl(url);
      assert.ok(resolved, `Không phân giải được URL: ${url}`);
      assert.ok(resolved.code, `Thiếu mã code cơ quan cho URL: ${url}`);
      assert.ok(resolved.subsite, `Thiếu subsite SharePoint cho URL: ${url}`);
      assert.ok(resolved.listTitle, `Thiếu listTitle cho URL: ${url}`);
      assert.equal(resolved.canDownload, true, `canDownload phải là true cho URL: ${url}`);

      const agency = resolveAgency(url);
      assert.ok(agency, `resolveAgency không nhận diện được URL: ${url}`);
      assert.equal(agency.code, resolved.code);
    }
  });

  it("nhận diện được các slug và biến thể viết hoa/thường", () => {
    assert.equal(resolveAgency("bqlkhucn")?.code, "liza");
    assert.equal(resolveAgency("socongthuong")?.code, "sct");
    assert.equal(resolveAgency("thanh-tra-tinh")?.code, "thanhtra");
    assert.equal(resolveAgency("sngv")?.code, "songoaivu");
    assert.equal(resolveAgency("so-ban-nganh/sngv")?.code, "songoaivu");
    assert.equal(resolveAgency("qppl/nghi-quyet")?.code, "hdnd");
    assert.equal(resolveAgency("qppl/quyet-dinh")?.code, "ubnd");
  });
});
