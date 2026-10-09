/**
 * Chuỗi tìm VB của qppl_lamdong: kho local → tự đồng bộ lần đầu → tra theo
 * khoảng ngày → tra live theo từ khóa → "mới nhất" của nguồn (chỉ khi không có
 * số hiệu cụ thể). Tách từ qppl-lamdong-tool.ts.
 */
import { searchQpplDocs, countQpplDocs } from "../../qppl/qppl-store.js";
import { syncQpplDocuments, liveSearchAndUpsert, liveSearchByDateRange } from "../../qppl/qppl-service.js";
import type { QpplDoc, QpplNguon } from "../../qppl/qppl-types.js";

export type DieuKienTim = {
  keyword?: string;
  loaiVanBan?: string;
  targetNguon?: QpplNguon;
  dateFrom?: string;
  dateTo?: string;
};

export async function timVanBanQppl(dk: DieuKienTim): Promise<QpplDoc[]> {
  const { keyword, loaiVanBan, targetNguon, dateFrom, dateTo } = dk;
  // Lấy nhiều kết quả để không bỏ sót văn bản khi người dùng yêu cầu tải hết
  const timLocal = () => searchQpplDocs({ keyword, loaiVanBan, nguon: targetNguon, dateFrom, dateTo, limit: 50 });
  let docs = timLocal();

  // Kho rỗng cho nguồn này (lần đầu) → auto-sync rồi tìm lại
  if (docs.length === 0 && countQpplDocs(targetNguon) === 0) {
    if (targetNguon) {
      await syncQpplDocuments(targetNguon, 100);
    } else {
      await syncQpplDocuments("ubnd", 100);
      await syncQpplDocuments("hdnd", 50);
    }
    docs = timLocal();
  }

  // Fallback 1: có dateFrom/dateTo → tra API theo khoảng ngày
  if (docs.length === 0 && dateFrom && dateTo) {
    docs = await liveSearchByDateRange({ dateFrom, dateTo, keyword, loaiVanBan, targetNguon, limit: 30 });
  }

  // Fallback 2: tra cứu live bằng keyword, rồi lọc lại theo ngày nếu có
  if (docs.length === 0 && keyword) {
    docs = await liveSearchAndUpsert(keyword, 30, targetNguon);
    if (dateFrom || dateTo) {
      docs = docs.filter((d) => {
        const date = d.ngayBanHanh?.slice(0, 10) ?? "";
        if (dateFrom && date < dateFrom) return false;
        if (dateTo && date >= dateTo) return false;
        return true;
      });
    }
  }

  // Không được lấy văn bản mới nhất khi người dùng yêu cầu tải theo số hiệu:
  // fallback này có thể gửi nhầm một văn bản khác nhưng vẫn mang file hợp lệ.
  const hasExplicitNumber = /\b\d+\s*\/\s*[A-ZĐÀ-Ỹ0-9][A-ZĐÀ-Ỹ0-9-]*\b/i.test(keyword || "");
  // Fallback 3: chỉ dùng cho yêu cầu thật sự là "mới nhất", không có số hiệu cụ thể.
  if (docs.length === 0 && targetNguon && !hasExplicitNumber) {
    docs = await liveSearchAndUpsert("", 30, targetNguon);
    if (loaiVanBan) {
      const lvbLower = loaiVanBan.toLowerCase();
      const filtered = docs.filter((d) => d.loaiVanBan.toLowerCase().includes(lvbLower));
      if (filtered.length > 0) docs = filtered;
    }
  }
  return docs;
}
