import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("review-admin-document");

type Ctx = Pick<ToolContext, "api" | "account" | "message">;

export const reviewAuditResultSchema = z.object({
  documentType: z.string().describe("Loại văn bản (Tờ trình, Quyết định, Công văn, Giấy mời...)"),
  summary: z.string().describe("Tóm tắt nội dung và mục đích chính của văn bản"),
  findings: z
    .array(
      z.object({
        severity: z
          .enum(["must_fix", "verify", "should_fix", "editorial"])
          .describe("Mức độ: must_fix (lỗi sai nghiêm trọng), verify (cần đối chiếu nguồn), should_fix (nên sửa để rõ logic), editorial (trau chuốt câu từ)"),
        category: z
          .enum(["the_thuc_nd30", "chinh_ta_ngon_ngu", "can_cu_phap_ly", "logic_nhiem_vu", "tham_quyen_ky", "noi_nhan"])
          .describe("Nhóm lỗi: the_thuc_nd30, chinh_ta_ngon_ngu, can_cu_phap_ly, logic_nhiem_vu, tham_quyen_ky, noi_nhan"),
        location: z.string().describe("Vị trí phát hiện lỗi (ví dụ: 'Điều 2, Khoản 1', 'Phần Căn cứ', 'Khối chữ ký')"),
        currentText: z.string().describe("Đoạn văn bản hiện tại có lỗi hoặc điểm cần chú ý"),
        issueDescription: z.string().describe("Phân tích lỗi sai hoặc lý do cần chỉnh sửa"),
        suggestedFix: z.string().describe("Đề xuất sửa đổi cụ thể"),
      }),
    )
    .describe("Danh sách các lỗi và phát hiện sau khi rà soát"),
  overallVerdict: z
    .enum(["dat_yeu_cau", "can_chinh_sua_truoc_khi_ky", "khong_dat_tra_lai"])
    .describe("Đánh giá chung: dat_yeu_cau, can_chinh_sua_truoc_khi_ky, khong_dat_tra_lai"),
  recommendation: z.string().describe("Khuyến nghị tổng thể cho người soạn thảo / lãnh đạo duyệt ký"),
});

export type ReviewAuditResult = z.infer<typeof reviewAuditResultSchema>;

import { detectOutdatedContent, replaceOutdatedOrgNamesInText } from "../outdated-content-guard.js";

type Finding = ReviewAuditResult["findings"][number];

function detectDocumentType(content: string): string {
  const head = content.slice(0, 600);
  if (/\bQUYẾT ĐỊNH\b/i.test(head)) return "Quyết định";
  if (/\bTỜ TRÌNH\b/i.test(head)) return "Tờ trình";
  if (/\bKẾ HOẠCH\b/i.test(head)) return "Kế hoạch";
  if (/\bBÁO CÁO\b/i.test(head)) return "Báo cáo";
  if (/\bTHÔNG BÁO\b/i.test(head)) return "Thông báo";
  if (/\bNGHỊ QUYẾT\b/i.test(head)) return "Nghị quyết";
  if (/\bCHỈ THỊ\b/i.test(head)) return "Chỉ thị";
  if (/\bKẾT LUẬN\b/i.test(head)) return "Kết luận";
  if (/\bGIẤY MỜI\b/i.test(head)) return "Giấy mời";
  if (/\bKính gửi:/i.test(head)) return "Công văn";
  return "Văn bản hành chính";
}

export function runProgrammatic7LayerAudit(
  content: string,
  targetStandard: "nd30_nha_nuoc" | "hd05_dang" = "nd30_nha_nuoc",
  contextNotes?: string,
): ReviewAuditResult {
  const findings: Finding[] = [];
  const docType = detectDocumentType(content);

  // Lớp 1: Thể thức chuẩn NĐ30/2020/NĐ-CP hoặc HD 05-HD/VPTW
  if (targetStandard === "nd30_nha_nuoc") {
    if (!/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(content)) {
      findings.push({
        severity: "should_fix",
        category: "the_thuc_nd30",
        location: "Phần Quốc hiệu - Tiêu ngữ",
        currentText: "(Thiếu Quốc hiệu)",
        issueDescription: "Chưa thấy Quốc hiệu 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' chuẩn Phụ lục I Nghị định 30/2020/NĐ-CP.",
        suggestedFix: "Bổ sung Quốc hiệu in hoa, cỡ chữ 12-13, kiểu chữ đứng, đậm và Tiêu ngữ 'Độc lập - Tự do - Hạnh phúc'.",
      });
    }
  } else if (targetStandard === "hd05_dang") {
    if (!/ĐẢNG CỘNG SẢN VIỆT NAM/i.test(content)) {
      findings.push({
        severity: "must_fix",
        category: "the_thuc_nd30",
        location: "Tiêu đề Đảng",
        currentText: "(Thiếu tiêu đề ĐẢNG CỘNG SẢN VIỆT NAM)",
        issueDescription: "Văn bản của Đảng theo Hướng dẫn 05-HD/VPTW bắt buộc có dòng 'ĐẢNG CỘNG SẢN VIỆT NAM' ở góc trên bên phải.",
        suggestedFix: "Bổ sung 'ĐẢNG CỘNG SẢN VIỆT NAM' in hoa, cỡ chữ 14-15, kiểu chữ đứng, đậm ở ô số 1b.",
      });
    }
  }

  // Lớp 2: Kiểm tra placeholder bỏ trống chưa điền số liệu/thông tin
  const placeholderRegex = /(\[\s*\.{2,}\s*\]|\.{4,}|<\s*[^>]+\s*>|\b(?:ngày\s*\.\.\.|tháng\s*\.\.\.|Số:\s*\/)\b)/g;
  const placeholderMatches = Array.from(new Set(content.match(placeholderRegex) ?? []));
  if (placeholderMatches.length > 0) {
    findings.push({
      severity: "verify",
      category: "chinh_ta_ngon_ngu",
      location: "Toàn văn bản",
      currentText: placeholderMatches.slice(0, 4).join(", "),
      issueDescription: `Phát hiện ${placeholderMatches.length} vị trí dấu nhắc/chỗ trống chưa điền số liệu hoặc thông tin cụ thể.`,
      suggestedFix: "Rà soát và điền đầy đủ số liệu, ngày tháng, số ký hiệu trước khi trình ký chính thức.",
    });
  }

  // Lớp 3: Cơ quan / đơn vị hành chính lỗi thời (6 Sở hợp nhất Lâm Đồng, Bộ ngành TW, mô hình 2 cấp)
  const outdated = detectOutdatedContent(content);
  if (outdated.found) {
    const correctedPreview = replaceOutdatedOrgNamesInText(content);
    findings.push({
      severity: "must_fix",
      category: "tham_quyen_ky",
      location: "Tên cơ quan / đơn vị hành chính",
      currentText: outdated.matches.join("; "),
      issueDescription:
        "Phát hiện tên cơ quan cũ (đã hợp nhất từ 01/03/2025) hoặc cấp hành chính quận/huyện cũ (đã chuyển sang mô hình chính quyền địa phương 02 cấp Tỉnh - Xã theo Luật 72/2025/QH15).",
      suggestedFix:
        correctedPreview !== content
          ? "Cập nhật sang tên cơ quan mới sau hợp nhất (Sở Tài chính, Sở Xây dựng, Sở Nông nghiệp và Môi trường, Sở Khoa học và Công nghệ, Sở Nội vụ, Sở Dân tộc và Tôn giáo) và bỏ cấp trung gian huyện/quận."
          : "Loại bỏ cấp huyện/quận, chuyển thẩm quyền tương ứng về UBND cấp tỉnh hoặc UBND cấp xã/phường.",
    });
  }

  // Lớp 4: Căn cứ pháp lý hết hiệu lực hoặc đã thay thế (2025-2026)
  const outdatedLegalRules: Array<{ re: RegExp; current: string; issue: string; fix: string }> = [
    {
      re: /Thông tư\s+(?:số\s+)?200\/2014\/TT-BTC/i,
      current: "Thông tư 200/2014/TT-BTC",
      issue: "Thông tư 200/2014/TT-BTC đã được thay thế bởi Thông tư 99/2025/TT-BTC kể từ ngày 01/01/2026.",
      fix: "Thay bằng: Thông tư số 99/2025/TT-BTC ngày 27/10/2025 của Bộ trưởng Bộ Tài chính hướng dẫn Chế độ kế toán doanh nghiệp.",
    },
    {
      re: /Hướng dẫn\s+(?:số\s+)?36-HD\/VPTW/i,
      current: "Hướng dẫn 36-HD/VPTW",
      issue: "Hướng dẫn 36-HD/VPTW về thể thức văn bản Đảng đã được thay thế bởi Hướng dẫn 05-HD/VPTW.",
      fix: "Thay bằng: Hướng dẫn số 05-HD/VPTW của Văn phòng Trung ương Đảng.",
    },
    {
      re: /Luật Tổ chức chính quyền địa phương\s+(?:năm\s+)?2015/i,
      current: "Luật Tổ chức chính quyền địa phương 2015",
      issue: "Luật Tổ chức chính quyền địa phương 2015 (sửa đổi 2019) đã hết hiệu lực, thay bằng Luật số 72/2025/QH15.",
      fix: "Thay bằng: Luật Tổ chức chính quyền địa phương số 72/2025/QH15 ngày 16/6/2025.",
    },
    {
      re: /\b(?:11\s*triệu|11\.000\.000).{0,40}(?:4,4\s*triệu|4\.400\.000)/i,
      current: "Giảm trừ gia cảnh 11 triệu / 4,4 triệu",
      issue: "Mức giảm trừ gia cảnh cũ (NQ 954/2020/UBTVQH14) đã hết hiệu lực từ kỳ tính thuế 2026.",
      fix: "Cập nhật mức giảm trừ gia cảnh mới theo NQ 110/2025/UBTVQH15 và Luật 109/2025/QH15: 15,5 triệu đồng/tháng (bản thân) và 6,2 triệu đồng/tháng (người phụ thuộc).",
    },
  ];

  for (const rule of outdatedLegalRules) {
    if (rule.re.test(content)) {
      findings.push({
        severity: "must_fix",
        category: "can_cu_phap_ly",
        location: "Phần Căn cứ pháp lý / Nội dung viện dẫn",
        currentText: rule.current,
        issueDescription: rule.issue,
        suggestedFix: rule.fix,
      });
    }
  }

  // Lớp 5: Logic giao nhiệm vụ (chủ trì - phối hợp - thời hạn)
  if (/(?:giao|đề nghị|yêu cầu)\s+(?:các\s+)?(?:sở|ban|ngành|đơn vị|địa phương)/i.test(content)) {
    const hasDeadline = /(?:trước ngày|chậm nhất|trong tháng|trong quý|định kỳ|hàng tháng|hàng quý|ngày\s+\d{1,2}\/\d{1,2})/i.test(content);
    if (!hasDeadline) {
      findings.push({
        severity: "should_fix",
        category: "logic_nhiem_vu",
        location: "Phần Tổ chức thực hiện / Giao nhiệm vụ",
        currentText: "Giao nhiệm vụ nhưng chưa nêu mốc thời gian hoàn thành",
        issueDescription: "Văn bản có nội dung giao nhiệm vụ cho các cơ quan/đơn vị nhưng chưa xác định rõ thời hạn báo cáo hoặc hoàn thành.",
        suggestedFix: "Bổ sung mốc thời gian cụ thể (ví dụ: 'hoàn thành trước ngày .../.../2026' hoặc 'báo cáo UBND tỉnh thông qua Sở ... trước ngày ...').",
      });
    }
  }

  // Lớp 6: Nơi nhận & Khối chữ ký
  if (!/Nơi nhận:/i.test(content) && docType !== "Báo cáo") {
    findings.push({
      severity: "should_fix",
      category: "noi_nhan",
      location: "Cuối văn bản (Phần Nơi nhận)",
      currentText: "(Chưa có mục Nơi nhận)",
      issueDescription: "Văn bản chưa có phần 'Nơi nhận:' đúng chuẩn thể thức (gồm các đơn vị nhận để thực hiện, báo cáo và 'Lưu: VT, ...').",
      suggestedFix: "Bổ sung phần 'Nơi nhận:' cỡ chữ 12 in nghiêng đậm, nội dung cỡ chữ 11 và dòng kết thúc 'Lưu: VT, [Chữ viết tắt đơn vị soạn thảo].'",
    });
  }

  // Lớp 7: Đối chiếu bối cảnh / văn bản cấp trên (nếu có contextNotes)
  if (contextNotes && contextNotes.trim().length > 0) {
    findings.push({
      severity: "verify",
      category: "logic_nhiem_vu",
      location: "Đối chiếu văn bản cấp trên / Bối cảnh",
      currentText: contextNotes.slice(0, 140),
      issueDescription: "Cần rà soát đối chiếu từng chỉ đạo/yêu cầu tại văn bản cấp trên để bảo đảm không bỏ sót nhiệm vụ hoặc sai lệch số liệu.",
      suggestedFix: "Thực hiện bảng đối chiếu song song giữa yêu cầu cấp trên và nội dung dự thảo.",
    });
  }

  const mustFixCount = findings.filter((f) => f.severity === "must_fix").length;
  const shouldFixCount = findings.filter((f) => f.severity === "should_fix" || f.severity === "verify").length;

  const overallVerdict: ReviewAuditResult["overallVerdict"] =
    mustFixCount >= 2
      ? "khong_dat_tra_lai"
      : mustFixCount === 1 || shouldFixCount > 0
        ? "can_chinh_sua_truoc_khi_ky"
        : "dat_yeu_cau";

  const recommendation =
    overallVerdict === "dat_yeu_cau"
      ? "Dự thảo đảm bảo thể thức, căn cứ pháp lý và tên gọi cơ quan hiện hành. Đủ điều kiện trình ký."
      : overallVerdict === "can_chinh_sua_truoc_khi_ky"
        ? `Cần hoàn thiện ${findings.length} điểm phát hiện (${mustFixCount} lỗi bắt buộc sửa) trước khi trình lãnh đạo ký ban hành.`
        : `Dự thảo có ${mustFixCount} lỗi trọng yếu về căn cứ pháp lý hoặc thẩm quyền/tên cơ quan sau sắp xếp. Đề nghị chỉnh sửa lại trước khi trình.`;

  return reviewAuditResultSchema.parse({
    documentType: docType,
    summary: `Rà soát tự động 7 lớp đối với ${docType} (${content.length} ký tự) theo chuẩn ${targetStandard === "nd30_nha_nuoc" ? "Nghị định 30/2020/NĐ-CP" : "Hướng dẫn 05-HD/VPTW"}.`,
    findings,
    overallVerdict,
    recommendation,
  });
}

export function reviewAdminDocumentTool(_ctx: Ctx) {
  return tool({
    description:
      "Rà soát, thẩm định chuyên sâu hồ sơ văn bản hành chính theo quy trình 7 lớp chuẩn Nghị định 30/2020/NĐ-CP " +
      "và quy chuẩn tham mưu tổng hợp (Chính tả ngôn ngữ, Thể thức NĐ30, Căn cứ pháp lý, Thẩm quyền ban hành, Logic giao nhiệm vụ, Nơi nhận).\n" +
      "Trả về bảng kết quả phân loại 4 mức độ: must_fix (bắt buộc sửa), verify (nghi vấn đối chiếu nguồn), should_fix (nên sửa rõ nghĩa), editorial (biên tập từ ngữ).",
    inputSchema: z.object({
      content: z.string().min(1).describe("Toàn bộ nội dung văn bản hoặc dự thảo cần rà soát"),
      targetStandard: z
        .enum(["nd30_nha_nuoc", "hd05_dang"])
        .default("nd30_nha_nuoc")
        .describe("Chuẩn đối chiếu: nd30_nha_nuoc (Nghị định 30) hoặc hd05_dang (Hướng dẫn 05 Đảng)"),
      contextNotes: z.string().optional().describe("Ghi chú bối cảnh hoặc tài liệu cấp trên để đối chiếu nếu có"),
    }),
    execute: async ({ content, targetStandard, contextNotes }) => {
      try {
        log.info({ chars: content.length, targetStandard }, "Bắt đầu rà soát văn bản hành chính 7 lớp");
        const auditResult = runProgrammatic7LayerAudit(content, targetStandard, contextNotes);

        const findingsReport =
          auditResult.findings.length === 0
            ? "- Không phát hiện lỗi tự động về tên cơ quan cũ, căn cứ pháp lý hết hiệu lực hoặc khuyết phần thể thức bắt buộc."
            : auditResult.findings
                .map(
                  (f, idx) =>
                    `${idx + 1}. [${f.severity.toUpperCase()} | ${f.category}] tại ${f.location}\n` +
                    `   - Hiện tại: ${f.currentText}\n` +
                    `   - Vấn đề: ${f.issueDescription}\n` +
                    `   - Đề xuất sửa: ${f.suggestedFix}`,
                )
                .join("\n");

        return (
          `KẾT QUẢ KIỂM TOÁN TỰ ĐỘNG 7 LỚP (${auditResult.documentType}):\n` +
          `- Kết luận sơ bộ: ${auditResult.overallVerdict} — ${auditResult.recommendation}\n` +
          `- Bối cảnh / Tài liệu cấp trên đối chiếu: ${contextNotes || "Không có"}\n\n` +
          `DANH SÁCH PHÁT HIỆN TỰ ĐỘNG (${auditResult.findings.length} mục):\n${findingsReport}\n\n` +
          `DỮ LIỆU CHUẨN HÓA (JSON):\n${JSON.stringify(auditResult)}\n\n` +
          `HƯỚNG DẪN TRÌNH BÀY CHO NGƯỜI DÙNG: Kết hợp toàn bộ các phát hiện tự động bên trên với phân tích ngữ nghĩa chuyên sâu câu chữ để trình bày kết quả rà soát 4 phần chuẩn: (1) Nhận định sơ bộ, (2) Bảng đối chiếu nội dung, (3) Bóc tách điểm cần chỉnh kèm câu chữ sửa cụ thể, (4) Khuyến nghị trình ký.`
        );
      } catch (err) {
        return ketQuaLoi(`Lỗi khi rà soát văn bản: ${String(err)}`);
      }
    },
  });
}

