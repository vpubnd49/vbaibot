import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectDisasterTypes,
  detectArea,
  isDisasterRelated,
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
});
