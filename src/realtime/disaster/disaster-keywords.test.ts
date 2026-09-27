import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectDisasterTypes,
  detectArea,
  isDisasterRelated,
  isAboutLamDong,
} from "./disaster-keywords.js";

describe("disaster-keywords", () => {
  // ───── detectDisasterTypes ────────────────────────────────────────────────

  it("phát hiện sạt lở từ nội dung bài viết", () => {
    const types = detectDisasterTypes("Đèo Bảo Lộc sạt lở nghiêm trọng, cấm xe tải qua lại");
    assert.ok(types.includes("landslide"), "Phải có landslide");
    assert.ok(types.includes("road_block"), "Phải có road_block (đèo Bảo Lộc)");
  });

  it("phát hiện mưa bão", () => {
    const types = detectDisasterTypes("Cảnh báo mưa rất to ở khu vực Tây Nguyên, gió giật cấp 8");
    assert.ok(types.includes("storm"), "Phải có storm");
  });

  it("phát hiện ngập lụt + xả lũ", () => {
    const types = detectDisasterTypes("Hồ Sông Quao xả tràn lưu lượng 150 m³/s, ngập nặng vùng hạ du");
    assert.ok(types.includes("flood"), "Phải có flood (xả tràn, ngập nặng)");
    assert.ok(types.includes("reservoir"), "Phải có reservoir (hồ Sông Quao)");
  });

  it("phát hiện hồ thủy điện cụ thể", () => {
    const types1 = detectDisasterTypes("Thủy điện Đa Nhim đang tăng lưu lượng xả");
    assert.ok(types1.includes("reservoir"));

    const types2 = detectDisasterTypes("Hồ Ba Bàu mở 5 cửa tràn");
    assert.ok(types2.includes("reservoir"));

    const types3 = detectDisasterTypes("Thủy điện Đắk R'Tih vận hành xả đáy");
    assert.ok(types3.includes("reservoir"));
  });

  it("phát hiện phòng thủ dân sự (tên mới)", () => {
    const types = detectDisasterTypes("BCH Phòng thủ dân sự tỉnh Lâm Đồng ra công điện khẩn");
    assert.ok(types.includes("general"));
  });

  it("giữ tương thích tên cũ PCTT", () => {
    const types = detectDisasterTypes("BCH PCTT tỉnh Lâm Đồng cảnh báo mưa lớn");
    assert.ok(types.includes("general"));
  });

  it("nhiều loại thiên tai đồng thời", () => {
    const text = "Mưa lớn kéo dài gây sạt lở đèo D'ran, hồ Đơn Dương xả lũ, ngập úng vùng hạ du";
    const types = detectDisasterTypes(text);
    assert.ok(types.includes("storm"), "storm");
    assert.ok(types.includes("landslide"), "landslide");
    assert.ok(types.includes("road_block"), "road_block (đèo D'ran)");
    assert.ok(types.includes("reservoir"), "reservoir (hồ Đơn Dương)");
    assert.ok(types.includes("flood"), "flood (ngập úng)");
  });

  it("không phát hiện sai khi nội dung bình thường", () => {
    const types = detectDisasterTypes("Đà Lạt hôm nay trời đẹp, nắng nhẹ 22°C, thích hợp đi chơi");
    assert.equal(types.length, 0);
  });

  // ───── detectArea ─────────────────────────────────────────────────────────

  it("phát hiện khu vực từ nội dung", () => {
    assert.equal(detectArea("Sạt lở ở Đà Lạt làm tắc đường Prenn"), "Đà Lạt");
    assert.equal(detectArea("Ngập nặng tại Phan Thiết do mưa lớn"), "Phan Thiết");
    assert.equal(detectArea("Thủy điện Đắk R'Tih ở Gia Nghĩa xả lũ"), "Gia Nghĩa");
  });

  it("trả về 'Lâm Đồng' khi không xác định khu vực", () => {
    assert.equal(detectArea("Cảnh báo mưa lớn diện rộng"), "Lâm Đồng");
  });

  // ───── isDisasterRelated ──────────────────────────────────────────────────

  it("isDisasterRelated hoạt động đúng", () => {
    assert.equal(isDisasterRelated("Hồ Sông Quao xả tràn"), true);
    assert.equal(isDisasterRelated("Quán cafe view đẹp ở Đà Lạt"), false);
  });

  // ───── isAboutLamDong (lọc địa lý) ────────────────────────────────────────

  it("nguồn Báo Lâm Đồng + nội dung chung → đạt", () => {
    assert.equal(isAboutLamDong("Mưa lớn gây ngập", "Báo Lâm Đồng - Thời sự"), true);
  });

  it("nguồn Báo Lâm Đồng nhưng đưa tin Đắk Lắk/Khánh Hòa → LOẠI", () => {
    assert.equal(
      isAboutLamDong("Cảnh báo lũ quét và sạt lở đất tại tỉnh Đắk Lắk, Khánh Hòa", "Báo Lâm Đồng - Thời sự"),
      false,
    );
  });

  it("nguồn baolamdong.vn → luôn đạt", () => {
    assert.equal(isAboutLamDong("Cảnh báo mưa to", "baolamdong"), true);
  });

  it("nhắc Đà Lạt → đạt", () => {
    assert.equal(isAboutLamDong("Sạt lở nghiêm trọng tại Đà Lạt", "VnExpress"), true);
  });

  it("nhắc đèo Bảo Lộc → đạt", () => {
    assert.equal(isAboutLamDong("Đèo Bảo Lộc sạt ta luy dương", "Tuổi Trẻ"), true);
  });

  it("nhắc hồ thủy điện Lâm Đồng → đạt", () => {
    assert.equal(isAboutLamDong("Thủy điện Đa Nhim xả lũ lưu lượng lớn", "NCHMF"), true);
  });

  it("nhắc Đắk Lắk mà KHÔNG nhắc Lâm Đồng → LOẠI", () => {
    assert.equal(isAboutLamDong("Mưa lớn gây ngập tại Buôn Ma Thuột, Đắk Lắk", "VnExpress"), false);
  });

  it("nhắc Khánh Hòa mà KHÔNG nhắc Lâm Đồng → LOẠI", () => {
    assert.equal(isAboutLamDong("Bão đổ bộ Nha Trang, Khánh Hòa thiệt hại nặng", "Thanh Niên"), false);
  });

  it("nhắc Đà Nẵng → LOẠI", () => {
    assert.equal(isAboutLamDong("Ngập lụt nghiêm trọng tại Đà Nẵng", "Tuổi Trẻ"), false);
  });

  it("bài chung chung toàn quốc không nhắc tỉnh nào → LOẠI", () => {
    assert.equal(isAboutLamDong("Cảnh báo mưa lớn diện rộng cả nước", "NCHMF"), false);
  });

  it("nhắc cả Đắk Lắk VÀ Đà Lạt → ĐẠT (vì có Lâm Đồng)", () => {
    assert.equal(isAboutLamDong("Mưa lớn ảnh hưởng Đà Lạt và Đắk Lắk", "VnExpress"), true);
  });

  it("khu vực Bình Thuận (sáp nhập) → đạt", () => {
    assert.equal(isAboutLamDong("Ngập nặng Phan Thiết do mưa lớn", "Báo Bình Thuận"), true);
  });

  it("khu vực Đắk Nông (sáp nhập) → đạt", () => {
    assert.equal(isAboutLamDong("Sạt lở tại Gia Nghĩa sau mưa kéo dài", "FB: Đắk Nông"), true);
  });
});

