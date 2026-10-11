/**
 * pass-claim-scrubber.ts
 * Lớp phòng thủ cuối cho câu trả lời về đèo: model đôi khi tự chèn câu trấn an
 * ("phương tiện lưu thông bình thường", "thông suốt"...) dù tin không nói vậy.
 * Thông tin an toàn giao thông sai có thể gây nguy hiểm → gỡ hẳn câu đó.
 *
 * Tách module riêng (không import db) để test thuần được.
 */

// Cụm khẳng định "an toàn" không có căn cứ
const CLAIM_RE =
  /(lưu thông|đi lại|giao thông|di chuyển)\s+(vẫn\s+)?(diễn ra\s+)?(bình thường|ổn định|thuận lợi|thông suốt|an toàn)|thông suốt|êm thuận|không có chướng ngại vật|không ghi nhận (sự cố|điểm sạt)/i;

// Câu có các từ phủ định/tính chất thì giữ (vd "chưa thông suốt", "không thể lưu thông bình thường")
const NEGATED_RE = /(chưa|không thể|không còn|chưa thể)\s+(được\s+)?(lưu thông|đi lại|giao thông|thông suốt)/i;

/** Gỡ câu/vế chứa khẳng định an toàn không căn cứ; giữ phần còn lại của dòng. */
export function scrubPassClaims(text: string): string {
  const src = text.split("\n");
  return src
    .map((line, idx) => {
      if (!CLAIM_RE.test(line)) return line;
      // Chỉ xử lý dòng nói về đèo (chính dòng đó hoặc dòng tiêu đề ngay trên)
      let prev = "";
      for (let j = idx - 1; j >= 0 && !prev; j--) prev = src[j]!.trim();
      if (!/đèo/i.test(line) && !/đèo/i.test(prev)) return line;
      // Tách theo câu và theo vế "nhưng/tuy nhiên" để giữ lại phần cảnh báo
      const parts = line.split(/(?<=[.;!?])\s+|,?\s+(?=nhưng\s|tuy nhiên\s)/i);
      const kept: string[] = [];
      let removedPrev = false;
      for (const p of parts) {
        if (CLAIM_RE.test(p) && !NEGATED_RE.test(p)) {
          removedPrev = true;
          continue;
        }
        let part = p;
        if (removedPrev) {
          // "nhưng cần cẩn trọng..." mồ côi sau khi gỡ vế trước → bỏ liên từ, viết hoa
          part = part.replace(/^(nhưng|tuy nhiên),?\s+/i, "");
          part = part.charAt(0).toUpperCase() + part.slice(1);
        }
        kept.push(part);
        removedPrev = false;
      }
      if (kept.length === parts.length) return line;
      const out0 = kept.join(" ").trim();
      let out = out0 ? out0.charAt(0).toUpperCase() + out0.slice(1) : "";
      // Giữ gạch đầu dòng / tiền tố markdown nếu vế đầu bị gỡ
      const prefix = /^(\s*(?:[-*•]|\d+\.)\s+(?:\*\*[^*]+\*\*:?\s*)?)/.exec(line)?.[1] ?? "";
      if (prefix && !out.startsWith(prefix.trim())) out = `${prefix}${out}`;
      return out.trim() === prefix.trim() ? "" : out;
    })
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}
